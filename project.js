import * as THREE from 'three';
import { Terrain, TerrainInfo } from './terrain.js';
import { Profiler } from './profiler.js';
import * as UTM from './geodesy/utm.js';

class Project
{
    /**
     * The THREE.Scene that this project is linked to.
     */
    scene;
    /**
     * The terrains for this project.
     */
    terrains;

    project_info = {};

    /**
     * Instantiates a new project.
     * @param {THREE.Scene} scene The scene with which to work with.
     */
    constructor(scene)
    {
        this.scene = scene;
        this.terrains = [];
    }

    /**
     * Loads a project from a file.
     * @param {string} path The project file to load.
     */
    async load_project(path)
    {
        Profiler.start_section('load file');
        let zipfile = await this.#load_zip_file(path);
        Profiler.end_section('load file');
        Profiler.start_section('get zip');
        let zipdata = await this.#get_zip_data(zipfile);
        Profiler.end_section('get zip');
        let project = await zipdata.file('project.json').async('string').then((data) => JSON.parse(data));
        this.project_info = project;
        let cnt = 0;
        for (let terrain of project.terrains)
        {
            Profiler.start_section('array buffer from zip');
            let buf = await zipdata.file(terrain.file).async('arraybuffer');
            Profiler.end_section('array buffer from zip');
            this.#load_terrain(terrain, buf);
            console.info('added terrain: ', terrain);
            //if (cnt++ > 0)
            //break;
        }
        window._data.load_profiler = Profiler.totals;
        //console.log(window._data.load_profiler);

        if (project.camera && project.camera.start_pos)
        {
            let pos = project.camera.start_pos;
            let look_at = project.camera.look_at;
            let height = this.get_terrain_height_at_location2(look_at.x, -look_at.y);
            if (height == -9999) height = 0;
            console.log('height at ', pos.x, pos.y, '=', height);
            window.app.camera.position.set(pos.x, height + 2000, -pos.y);
            window.app.controls.target = new THREE.Vector3(look_at.x, height, -look_at.y);
            window.app.controls.update();
        }

        return Profiler.totals;
    }

    /**
     * Unloads the project.
     */
    unload_project()
    {
        for (let terrain of this.terrains)
        {
            terrain.destroy();
        }
        console.log('unloaded project');
    }

    /**
     * Runs a the terrain level of detail update check.
     * @param {THREE.Camera} camera The camera for the scene. Needed to work out what LOD to apply to terrain chunks.
     */
    update_terrain_lod(camera)
    {
        for (let terrain of this.terrains)
        {
            terrain.camera_position_update(camera);
        }
    }

    /**
     * Converts a latitude and longitude into UTM.
     * @param {number} lat 
     * @param {number} lon 
     * @return {object} Object containing the easting, northing and zone values.
     */
    convert_latlon_to_utm(lat, lon)
    {
        let latlon = new UTM.LatLon(lat, lon);
        let utm = latlon.toUtm();
        return {zone: utm.zone, easting: utm.easting.toFixed(0), northing: utm.northing.toFixed(0)};
        // let test = new UTM.LatLon(-33.76329230013953, 150.6548683296836);
    // console.log(test.toUtm().toString());
    // test = new UTM.LatLon(-33.7633156, 150.6548521);
    // console.log(test.toUtm().toString());
    }

    /**
     * Gets a 3D position for a UTM coordinate.
     * @param {number} easting 
     * @param {number} northing
     * @return {THREE.Vector3}
     */
    get_3dposition_for_utm(easting, northing)
    {
        let x = easting - this.project_info.origin.x;
        let z = -(northing - this.project_info.origin.y);
        let y = this.get_terrain_height_at_location(x, z);
        return new THREE.Vector3(x, y, z);
    }

    #load_terrain(info, buf)
    {
        let TI = new TerrainInfo();
        TI.chunk_size = 400;
        TI.data_size = {w: info.size.x / info.resolution + 1, h: info.size.y / info.resolution + 1};
        TI.size = {w: info.size.x, h: info.size.y};
        TI.position = {
            x: info.pos.x - this.project_info.origin.x, 
            y: -(info.pos.y - this.project_info.origin.y)
        };
        TI.native_resolution = info.resolution;
        console.log(TI);
        let T = new Terrain(this.scene, TI, buf);
        this.terrains.push(T);
    }

    /**
     * Gets the terrain height for a given x/z location. This function uses a raycaster.
     * @param {integer} x The x location in the scene.
     * @param {integer} z The z location in the scene. Remember that z positions should be negative!
     * @return {float} The height value. If there is no terrain returns -9999
     */
    get_terrain_height_at_location(x, z)
    {
        const raycaster = new THREE.Raycaster(new THREE.Vector3(x, 9999, z), new THREE.Vector3(0, -1, 0), 0, 10000);
        raycaster.layers.set(1);    // only test against terrain meshes
        //console.log(this.scene.children);
        const intersects = raycaster.intersectObjects(this.scene.children);
        if (intersects.length == 0) return -9999;
        let point = intersects[0].point;
        return point.y;
    }

    /**
     * Gets thet errain height for a given x/z coordinate. This function looks at the terrain height data to work out the height.
     * @param {integer} x The x location in the scene
     * @param {integer} z The z location in the scene
     * @return {float} The height value. If there is no terrain return -9999. 
     */
    get_terrain_height_at_location2(x, z)
    {
        for (let terrain of this.terrains)
        {
            let bottom_left = terrain.info.position;
            let size = terrain.info.size; 
            if (x >= bottom_left.x && x <= bottom_left.x + size.w && z <= bottom_left.y && z >= bottom_left.y - size.h)
            {
                return terrain.get_height_at_location(x, z);
            }
        }
        return -9999;
    }


    #load_zip_file(file)
    {
        return new Promise((resolve, reject) => {
            fetch(file)
                .then((response) => response.arrayBuffer())
                .then((buffer) => {
                    resolve(buffer);
                });
        })
        
    }

    #get_zip_data(zipfile)
    {
        return new Promise((resolve, reject) => {
            let Z = new JSZip();
            Z.loadAsync(zipfile)
                .then((zipobj) => {
                    // zipobj.folder("").forEach(function (relativePath, file){
                    //     console.log("iterating over", relativePath);
                    // });
                    resolve(zipobj);
                })
        })
    }

}

export {Project};
