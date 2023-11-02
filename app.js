import * as THREE from 'three'
// import { OrbitControls } from './addons/controls/OrbitControls.js';
import { MapControls } from './addons/controls/MapControls.js';
import { Project } from './project.js';
import { Profiler } from './profiler.js';
import { Vector3 } from './three.module.min.js';
import { DevicePosition } from './deviceposition.js';
import { GPSPositionMarker, PositionMarker, ScreenSpace } from './position_marker.js';
import { KML } from './kml.js';

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
    prv_cam_state;
    prv_control_state;
    #user_is_updating_controls = false;
    /**
     * @type {Project} The project instance for this app.
     */
    project;

    kml;

    #lod_update_timeout = undefined;

    #gps_marker = null;
    #locations = [];

    #display_width;
    #display_height;

    /**
     * Indicates if the camera should follow the GPS position.
     */
    #follow_gps = false;

    _sim_gps_update = null;

    constructor()
    {
        this.debuginfo = {
            triangle_cnt: 0,
            fps: {start: Date.now(), cnt: 0}
        };
        this.prv_cam_state = {rot: new THREE.Vector3(), pos: new THREE.Vector3()};
        this.prv_control_state = {target: new THREE.Vector3()};
        window._data = {};
        window._data.profiler = Profiler;
        this.profiler = Profiler;
        window.app = this;
        this.#display_height = 0;
        this.#display_width = 0;
        let self = this;
        this.devicepos = new DevicePosition(() => self.#on_gps_init(), () => self.#on_gps_update(), () => self.#on_gps_stopped(), (error) => self.#on_gps_error(error));
    };

    initialise()
    {
        this.#setup_renderer();
        this.#render_loop();
        let self = this;
        this.renderer.domElement.ondblclick = ((e) => self.#double_clicked_scene(e));
        this.#gps_marker = new GPSPositionMarker(this.scene);
        this.#gps_marker.visible(false);
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

    async load_kml(file)
    {
        if (this.#locations.length > 0) {
            //need to remove existing locations
            for (let location of this.#locations)
            {
                location.destroy();
            }
            this.#locations = [];
        }
        if (!this.project)
        {
            alert('Need to load a project before a KML file can be loaded');
            return;
        }
        let kml = new KML();
        this.kml = await kml.load(file);
        let labels_container = document.getElementById('labels');
        for (let location of this.kml.locations)
        {
            //console.log(location);
            let utm = this.project.convert_latlon_to_utm(location.lat, location.lon);
            let x = utm.easting - this.project.project_info.origin.x;
            let z = utm.northing - this.project.project_info.origin.y;
            let y = this.project.get_terrain_height_at_location2(x, -z);
            if (y == -9999) continue;   // skip as there is no terrain to place the marker on.
            let marker = new PositionMarker(this.scene, new Vector3(x, y, -z), 3);
            marker.set_label(location.name);
            this.#locations.push(marker);
            //console.log(location.name, x,y,-z);
        }
    }


    #setup_renderer()
    {

        this.renderer = new THREE.WebGLRenderer({canvas: document.getElementById('render_canvas')});
        this.#display_width = window.innerWidth;
        this.#display_height = window.innerHeight;
        this.renderer.setSize( this.#display_width, this.#display_height );
        document.body.appendChild( this.renderer.domElement );
        let self = this;
        window.addEventListener('resize', (e) => {
            self.#display_width = window.innerWidth;
            self.#display_height = window.innerHeight;
            self.camera.aspect = self.#display_width / self.#display_height;
            self.camera.updateProjectionMatrix();
            self.renderer.setSize(self.#display_width, self.#display_height);
            self.#update_marker_labels();
        });

        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera( 45, self.#display_width / self.#display_height, 1, 15000 );
        this.controls = new MapControls( this.camera, this.renderer.domElement );
        this.controls.maxDistance = 15000;
        this.controls.minDistance = 50;
        this.controls.addEventListener('start', () => self.#controls_input('start'));
        this.controls.addEventListener('end', () => self.#controls_input('end'));
        //this.controls.zoomToCursor = true;

        const axesHelper = new THREE.AxesHelper( 200 );
        this.scene.add( axesHelper );

        this.scene.background = new THREE.Color(0.66,0.89,0.95);

        // White directional light shining from the top.
        this.light = new THREE.DirectionalLight( 0xffffff, 1 );
        this.scene.add( this.light );
        this.scene.add( this.light.target);
        this.light.target.position.set(0, 0, 0);

        // const helper = new THREE.DirectionalLightHelper( this.light, 30 );
        // this.scene.add( helper );
        // this.debuginfo.lighthelper = helper;
    }

    #render_loop()
    {
        let self = this;
        let view_change = false;
        
        requestAnimationFrame( () => {self.#render_loop() });
        // required if controls.enableDamping or controls.autoRotate are set to true
        this.controls.update();

        if (!this.prv_cam_state.rot.equals(this.camera.rotation) || !this.prv_cam_state.pos.equals(this.camera.position)) view_change = true;
    
        this.renderer.render( this.scene, this.camera );
        if (this.renderer.info.render.triangles != this.debuginfo.triangle_cnt){
            this.debuginfo.triangle_cnt = this.renderer.info.render.triangles;
            //console.log('Triangles: ', triangle_cnt);
            let el = document.getElementById('triangles');
            el.innerHTML = this.debuginfo.triangle_cnt;
        }

        if (view_change)
        {
            this.#update_marker_labels();
            this.#update_light();
            this.#update_compass();
            if (this.#user_is_updating_controls && !this.prv_control_state.target.equals(this.controls.target))
            {
                if (this.#follow_gps) this.unfollow_gps();
            }

            if (this.project)
            {
                clearTimeout(this.#lod_update_timeout);
                let self = this;
                this.#lod_update_timeout = setTimeout((() => {self.#update_lod()}), 500);  // wait half a second before updating meshes to ensure the user has stopped moving. This is more of an issue on mobile devices. On desktops this delay could be reduced considerably.
            }
        }

        this.prv_cam_pos = {x: this.camera.position.x, y: this.camera.position.y, z: this.camera.position.z};
    
        this.prv_cam_state.rot = this.camera.rotation.clone();
        this.prv_cam_state.pos = this.camera.position.clone();
        this.prv_control_state.target = this.controls.target.clone();
        
        this.#calc_fps();
    }

    /**
     * Controls received user input.
     */
    #controls_input(state)
    {
        if (state == 'start') this.#user_is_updating_controls = true;
        if (state == 'end') this.#user_is_updating_controls = false;
        console.log('changed', state);
    }
    
    #update_light()
    {
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

        //this.debuginfo.lighthelper.update();
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
        raycaster.layers.set(1);    // only test against terrain meshes

        pointer.x = ( e.clientX / this.#display_width ) * 2 - 1;
        pointer.y = - ( e.clientY / this.#display_height ) * 2 + 1;

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

        if (this.#follow_gps) this.unfollow_gps();
    }

    /**
     * Change the GPS state when tapping the GPS icon. Can switch between on -> follow -> off.
     */
    switch_gps_state()
    {
        if (this.devicepos.state == 'off')
        {
            this.devicepos.init_geolocation();
        }
        else
        {
            // Follow GPS if not already following and the device has started to receive position information. Else stop the GPS.
            if (!this.#follow_gps && this.devicepos.state == 'receiving')
            {
                this.follow_gps();
            }
            else
            {
                this.devicepos.stop_geolocation();
                this.#follow_gps = false;
            }
        }
    }

    /**
     * Called when GPS locating is started.
     */
    #on_gps_init()
    {
        this.#gps_marker.visible(true);
        let gps_el = $('#gps');
        gps_el.removeClass('gps_off gps_follow');
        gps_el.addClass('gps_on');
        let el = document.getElementById('geolocation');
        if (el) el.innerHTML = 'Starting GPS';
        console.log('start geolocation');
    }

    /**
     * Called when GPS location is updated.
     */
    #on_gps_update()
    {
        if (this.project)
        {
            let utm = this.project.convert_latlon_to_utm(this.devicepos.lat, this.devicepos.lon);
            let pos = this.project.get_3dposition_for_utm(utm.easting, utm.northing);
            console.log(this.devicepos, utm, pos);
            this.#gps_marker.set_position(pos, this.devicepos.accuracy);
            if (this.#follow_gps) this.#focus_camera_on_location(pos);
        }
        let el = document.getElementById('geolocation');
        if (el)
        {
            const altitude = this.devicepos.altitude ? this.devicepos.altitude.toFixed(1) + 'm' : 'n/a';
            const altitude_accuracy = this.devicepos.altitude_accuracy ? this.devicepos.altitude_accuracy.toFixed(1) + 'm': 'n/a';
            const heading = this.devicepos.heading ? this.devicepos.heading.toFixed(1) : 'n/a';
            const speed = this.devicepos.speed ? this.debuginfo.speed.toFixed(1) + 'm/s' : 'n/a';
            let html = `Latitude: ${this.devicepos.lat}, Longitude: ${this.devicepos.lon}, Accuracy: ${this.devicepos.accuracy.toFixed(1)} m` + '<br/>';
            html += `Altitude: ${altitude}, Altitude Accuracy: ${altitude_accuracy}` + '<br/>';
            html += `Heading: ${heading}, Speed: ${speed}`;
            el.innerHTML = html;
        }
    }

    /**
     * Called when GPS locating is stopped.
     */
    #on_gps_stopped()
    {
        this.#gps_marker.visible(false);
        let gps_el = $('#gps');
        gps_el.removeClass('gps_on gps_follow');
        gps_el.addClass('gps_off');
        let el = document.getElementById('geolocation');
        if (el) el.innerHTML = 'GPS stopped';
        console.log('stopped geolocation');
    }
    
    /**
     * Called on GPS locating error.
     * @param {object} error 
     */
    #on_gps_error(error, obj)
    {
        let el = document.getElementById('geolocation');
        if (el) el.innerHTML = 'Unable to retrieve your location: ' + error.message;
        alert('Unable to retrieve your location: ' + error.message);
    }

    /**
     * Tell the camera to follow the GPS position marker.
     */
    follow_gps()
    {
        console.log('follow GPS marker');
        this.#follow_gps = true;
        let gps_el = $('#gps');
        gps_el.removeClass('gps_on gps_off');
        gps_el.addClass('gps_follow');
    }

    unfollow_gps()
    {
        console.log('unfollow GPS marker');
        this.#follow_gps = false;
        let gps_el = $('#gps');
        gps_el.removeClass('gps_off gps_follow');
        gps_el.addClass('gps_on');
    }


    #update_marker_labels()
    {let start = Date.now();
        let self = this;
        ScreenSpace.reset(this.#display_width, this.#display_height);
        // For working out if the marker is in the frustrum
        const frustum = new THREE.Frustum();
        frustum.setFromProjectionMatrix(this.camera.projectionMatrix)
        frustum.planes.forEach(function(plane) { plane.applyMatrix4(self.camera.matrixWorld) })
        let cnt = 0;
        for (let location of this.#locations)
        {
            let bb = new THREE.Box3().setFromObject(location.mesh);
            if(frustum.intersectsBox(bb)) 
            {
                location.update_label_position(this.camera, this.#display_width, this.#display_height);
            }
            else
            {
                location.is_visible = false;
                location.label_el.style.opacity = 0;
            }
            //if (cnt++ > 0) break;
            if (location.is_visible) cnt++;
        }
        let end = Date.now();
        console.log('updating markers took ' + (end - start) + 'ms', 'visible: ', cnt);
    }

    #update_compass()
    {
        let cam_rot = this.camera.rotation.clone();
        cam_rot.reorder('YXZ');      // Change the order in which rotations are applied from the default (XYZ) to XYZ which is easier for me to work with. Y will have values from -180 to 180.
        let y = 360 + cam_rot.y * 180 / Math.PI
        if (y > 360) y -= 360;
        console.log(y);
        $('.compass').get(0).style.transform = `rotate(${y}deg)`;
    }

    /**
     * Focuses the camera onto the given location. This only works for locations within the bounds of the current project.
     * @param {THREE.Vector3} location 
     */
    #focus_camera_on_location(location)
    {
        if (!this.project.is_location_in_bounds(location)) return;
        // apply current distance difference to new target
        let x = location.x + this.camera.position.x - this.controls.target.x;
        let y = location.y + this.camera.position.y - this.controls.target.y;
        let z = location.z + this.camera.position.z - this.controls.target.z;

        this.camera.position.setX(x);
        this.camera.position.setZ(z);
        this.camera.position.setY(y);

        this.controls.target = location;
        this.controls.update();

        this.prv_control_state.target = location;
    }

    // For testing with a moving gps position
    simulate_gps_update()
    {
        this.devicepos.lat += 0.000001;
        this.devicepos.lon += 0.000001;
        let lat = this.devicepos.lat
        let lon = this.devicepos.lon;
        if (this.project)
        {
            let utm = this.project.convert_latlon_to_utm(lat, lon);
            let pos = this.project.get_3dposition_for_utm(utm.easting, utm.northing);
            if (pos.y == -9999) pos.y = 0;
            //console.log(this.devicepos, utm, pos);
            this.#gps_marker.set_position(pos, this.devicepos.accuracy);
            if (this.#follow_gps) this.#focus_camera_on_location(pos);
        }
        let el = document.getElementById('geolocation');
        if (el)
        {
            const altitude = this.devicepos.altitude ? this.devicepos.altitude.toFixed(1) + 'm' : 'n/a';
            const altitude_accuracy = this.devicepos.altitude_accuracy ? this.devicepos.altitude_accuracy.toFixed(1) + 'm': 'n/a';
            const heading = this.devicepos.heading ? this.devicepos.heading.toFixed(1) : 'n/a';
            const speed = this.devicepos.speed ? this.debuginfo.speed.toFixed(1) + 'm/s' : 'n/a';
            let html = `Latitude: ${lat}, Longitude: ${lon}, Accuracy: ${this.devicepos.accuracy.toFixed(1)} m` + '<br/>';
            html += `Altitude: ${altitude}, Altitude Accuracy: ${altitude_accuracy}` + '<br/>';
            html += `Heading: ${heading}, Speed: ${speed}`;
            el.innerHTML = html;
        }
        let self = this;
        this._sim_gps_update = setTimeout(() => self.simulate_gps_update(), 150);
    }

    stop_simulate_gps_update()
    {
        clearTimeout(this._sim_gps_update);
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
