import * as THREE from 'three'
import { OrbitControls } from './addons/controls/OrbitControls.js';
import { Project } from './project.js';
import { Profiler } from './profiler.js';
import { Vector3 } from './three.module.min.js';
import { DevicePosition } from './deviceposition.js';
import { PositionMarker } from './position_marker.js';

/**
 * The application. Top level class that manages everything.
 */
class App
{
    renderer;
    scene;
    camera;
    controls;
    light;
    devicepos;

    debuginfo = {};
    prv_cam_pos = {};

    project;

    #lod_update_timeout = undefined;

    #position_marker = null;

    constructor()
    {
        this.debuginfo = {
            triangle_cnt: 0,
            fps: {start: Date.now(), cnt: 0}
        };
        this.prv_cam_pos = {x:0, y:0, z:0};
        window._data = {};
        window._data.profiler = Profiler;
        this.profiler = Profiler;
        window.app = this;
    };

    initialise()
    {
        this.#setup_renderer();
        this.#render_loop();
        let self = this;
        this.renderer.domElement.ondblclick = ((e) => self.#double_clicked_scene(e));
        this.devicepos = new DevicePosition(() => self.#on_position_update(), document.getElementById('geolocation'));
        this.#position_marker = new PositionMarker(this.scene);
        this.#position_marker.mesh.visible = false;
    }

    load_project(file)
    {
        if (this.project) this.project.unload_project();
        this.project = new Project(this.scene);
        this.project.load_project(file).then((info) => show_load_time(info));
    }

    unload_project()
    {
        if (this.project) this.project.unload_project();
        this.project = null;
    }

    /**
     * Tell the app to turn on GPS
     */
    start_geolocation()
    {
        this.devicepos.init_geolocation();
        this.#position_marker.mesh.visible = true;
    }

    /**
     * Tell the app to turn off GPS
     */
    stop_geolocation()
    {
        this.devicepos.stop_geolocation();
        this.#position_marker.mesh.visible = false;
    }

    #setup_renderer()
    {
        this.renderer = new THREE.WebGLRenderer();
        this.renderer.setSize( window.innerWidth, window.innerHeight );
        document.body.appendChild( this.renderer.domElement );

        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera( 45, window.innerWidth / window.innerHeight, 1, 10000 );
        this.controls = new OrbitControls( this.camera, this.renderer.domElement );
        this.controls.maxDistance = 10000;
        this.controls.minDistance = 100;

        const axesHelper = new THREE.AxesHelper( 200 );
        this.scene.add( axesHelper );

        this.scene.background = new THREE.Color(0.2,0.2,0.2);

        // White directional light shining from the top.
        this.light = new THREE.DirectionalLight( 0xffffff, 1 );
        this.scene.add( this.light );
        this.scene.add( this.light.target);
        this.light.target.position.set(0, 0, 0);

        const helper = new THREE.DirectionalLightHelper( this.light, 30 );
        this.scene.add( helper );
        this.debuginfo.lighthelper = helper;

        
    }

    #render_loop()
    {
        let self = this;
        requestAnimationFrame( () => {self.#render_loop() });
        // required if controls.enableDamping or controls.autoRotate are set to true
        this.controls.update();
    
        this.renderer.render( this.scene, this.camera );
        if (this.renderer.info.render.triangles != this.debuginfo.triangle_cnt){
            this.debuginfo.triangle_cnt = this.renderer.info.render.triangles;
            //console.log('Triangles: ', triangle_cnt);
            let el = document.getElementById('triangles');
            el.innerHTML = this.debuginfo.triangle_cnt;
        }

        this.#update_light();

        if (this.project && (this.camera.position.x != this.prv_cam_pos.x || this.camera.position.y != this.prv_cam_pos.y || this.camera.position.z != this.prv_cam_pos.z))
        {
            clearTimeout(this.#lod_update_timeout);
            let self = this;
            this.#lod_update_timeout = setTimeout((() => {self.#update_lod()}), 500);  // wait half a second before updating meshes to ensure the user has stopped moving. This is more of an issue on mobile devices. On desktops this delay could be reduced considerably.
        }
    
        this.prv_cam_pos = {x: this.camera.position.x, y: this.camera.position.y, z: this.camera.position.z};
    
        this.#calc_fps();
        
    }
    
    #update_light()
    {
        if (this.camera.position.x == this.prv_cam_pos.x && this.camera.position.y == this.prv_cam_pos.y && this.camera.position.z == this.prv_cam_pos.z) return;

        let cam_rot = this.camera.rotation.clone();
        cam_rot.reorder('YXZ');      // Change the order in which rotations are applied from the default (XYZ) to XYZ which is easier for me to work with. Y will have values from -180 to 180, X will have values from -90 to 90. Don't care about Z.
        cam_rot = convert_euler_to_degrees(cam_rot);

        let dist = 1;
        let center = new Vector3(0,0,0);
        let radians = {x: cam_rot.x * Math.PI / 180, y: (cam_rot.y - 20) * Math.PI / 180, z: 0};
        //console.log('rot', get_vector_value(rot_inv), 'radians', radians);
        let z = center.z - dist * Math.cos(radians.y) * 1;
        let x = center.x - dist * Math.sin(radians.y) * 1;
        this.light.target.position.set(x, 0, z);

        this.debuginfo.lighthelper.update();
    }

    #update_lod()
    {
        window._data.profiler.clear();
        let _t1 = Date.now();
        this.project.update_terrain_lod(this.camera);
        let _t2 = Date.now();
        console.log('updating terrain lods took', _t2 - _t1);
        let el = document.getElementById('profiler');
        let html = '';
        let totals = window._data.profiler.totals;
        html += 'remove mesh: ' + (totals['remove mesh'] ?? '') + '<br/>';
        html += 'create geo: ' + (totals['create geometry'] ?? '') + '<br/>';
        html += 'create mesh: ' + (totals['create mesh and add to scene'] ?? '') + '<br/>';
        html += 'set vertex: ' + (totals['set vertex values'] ?? '') + '</br>';
        el.innerHTML = html;
    }

    #calc_fps()
    {
        let now = Date.now();
        if (this.debuginfo.fps.start + 1000 < now)
        {
            //console.log('fps is ', fps.cnt);
            let el = document.getElementById('fps');
            el.innerHTML = this.debuginfo.fps.cnt;
            this.debuginfo.fps.start = now;
            this.debuginfo.fps.cnt = 0;
        }
        else
        {
            this.debuginfo.fps.cnt++;
        }
    }

    // On double click see if a point on a terrain was selected and put the camera orbit location around that point.
    #double_clicked_scene(e)
    {
        let pointer = {x: 0, y: 0};
        const raycaster = new THREE.Raycaster();

        pointer.x = ( e.clientX / this.renderer.domElement.width ) * 2 - 1;
        pointer.y = - ( e.clientY / this.renderer.domElement.height ) * 2 + 1;

        // update the picking ray with the camera and pointer position
        raycaster.setFromCamera( pointer, this.camera );

        // calculate objects intersecting the picking ray
        const intersects = raycaster.intersectObjects(this.scene.children);
        if (intersects.length == 0) return;
        let point = intersects[0].point;

        // apply current distance difference to new target
        let x = point.x + this.camera.position.x - this.controls.target.x;
        let y = point.y + this.camera.position.y - this.controls.target.y;
        let z = point.z + this.camera.position.z - this.controls.target.z;

        this.camera.position.setX(x);
        this.camera.position.setZ(z);
        this.camera.position.setY(y);

        this.controls.target = point;
        this.controls.update();
    }

    /**
     * Called when GPS location is updated.
     */
    #on_position_update()
    {
        if (this.project)
        {
            let utm = this.project.convert_latlon_to_utm(this.devicepos.lat, this.devicepos.lon);
            let pos = this.project.get_3dposition_for_utm(utm.easting, utm.northing);
            console.log(this.devicepos, utm, pos);
            this.#position_marker.mesh.position.set(pos.x, pos.y, pos.z);
        }
        
    }

}

function convert_euler_to_degrees(euler)
{
    return new Vector3(
        euler.x * 180 / Math.PI,
        euler.y * 180 / Math.PI,
        euler.z * 180 / Math.PI,
    );
}
// for seeing how long it takes to load a project
function show_load_time(info)
{
    let el = document.getElementById('loadtime');
    let totals = window._data.profiler.totals;
    let html = 'load file: ' + (totals['load file'] ?? '') + '<br/>';
    html += 'get zip: ' + (totals['get zip'] ?? '') + '<br/>';
    html += 'array buf: ' + (totals['array buffer from zip'] ?? '') + '<br/>';
    el.innerHTML = html;
}

export {App};
