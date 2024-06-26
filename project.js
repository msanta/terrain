import * as THREE from 'three';
import { Terrain, TerrainInfo } from './terrain.js';
import { Profiler } from './profiler.js';
import * as UTM from './geodesy/utm.js';
import { Helper } from './helper.js';

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
     * @type {object} Registered event handlers
     */
    #event_handlers = {};

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

        this.dispatch_event('loaded', this.project_info);

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
        return Helper.convert_latlon_to_utm(lat, lon, this.project_info.zone);
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
        let y = this.get_terrain_height_at_location2(x, z);
        return new THREE.Vector3(x, y, z);
    }

    #load_terrain(info, buf)
    {
        let TI = new TerrainInfo();
        TI.chunk_size = 400;
        if (info.size.x % TI.chunk_size !== 0)  // Can the terrain be evenly divided by chunk size? If not, try other factors.
        {
            if (info.size.x % 250 == 0)
                TI.chunk_size = 250;
            else
                TI.chunk_size = info.size.x;
        }
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

    /**
     * Checks if the location is in the project's bounds. The bounds are the terrain tiles plus a 2km buffer.
     * @param {THREE.Vector3} location 
     */
    is_location_in_bounds(location)
    {
        const buffer = 2000;
        let bottom_left = {x: 100000, z: -100000};
        let top_right = {x: -100000, z: 100000};
        for (let terrain of this.terrains)
        {
            if (terrain.info.position.x < bottom_left.x) bottom_left.x = terrain.info.position.x;
            if (terrain.info.position.y > bottom_left.z) bottom_left.z = terrain.info.position.y;
            if (terrain.info.position.x + terrain.info.size.w > top_right.x) top_right.x = terrain.info.position.x + terrain.info.size.w;
            if (terrain.info.position.y - terrain.info.size.h < top_right.z) top_right.z = terrain.info.position.y - terrain.info.size.h;
        }
        //console.log(bottom_left, top_right);
        return !(location.x < bottom_left.x - buffer || location.x > top_right.x + buffer || location.z > bottom_left.z + buffer || location.z < top_right.z - buffer);
    }

    /**
     * Get the UTM zone for this project.
     * @returns {number} The project UTM zone.
     */
    get_utm_zone()
    {
        return this.project_info.zone;
    }

    /**
     * Checks if two points have a direct line of sight to each other based on the terrain.
     * @param {THREE.Vector3} pt1 Point 1
     * @param {THREE.Vector3} pt2 Point 2
     * @param {float} cutoff The max distance to check for line of sight, defaults to null. Any points further than this are assumed to be not in line of sight. If null then no cutoff is used.
     * @returns 
     */
    in_line_of_sight(pt1, pt2, cutoff = null)
    {
        const dx = pt1.x - pt2.x;
        const dy = pt1.y - pt2.y;
        const dz = pt1.z - pt2.z;
        const dist = pt1.distanceTo(pt2); // Math.sqrt(dx * dx + dz * dz);
        if (cutoff !== null && dist > cutoff) return false;
        const dirx = dx !== 0 ? -dx / dx : 0;
        const diry = dy !== 0 ? -dy / dy : 0;
        const dirz = dz !== 0 ? -dz / dz : 0;
        
        // Take X meter steps along a line from pt1 to pt2 and check if the terrain height is greater than the height of the line at that point. If so then there is no clear line of sight. The stepsize depends on the distance.
        let stepsize = dist / 100;      // TODO: improve this when the camera is looking straight down from a distance.
        if (stepsize < 2) stepsize = 2;
        let started_below_ground = false;
        for (let i = 0; i < dist; i += stepsize)
        {
            let ratio = i / dist;
            let px = pt1.x + dx * ratio * dirx;
            let pz = pt1.z + dz * ratio * dirz;
            let py = pt1.y + dy * ratio * diry;
            let height = -9999;
            for (let terrain of this.terrains)
            {
                let bottom_left = terrain.info.position;
                let size = terrain.info.size; 
                if (px >= bottom_left.x && px <= bottom_left.x + size.w && pz <= bottom_left.y && pz >= bottom_left.y - size.h)
                {
                    height = terrain.get_height_at_location(px, pz);
                }
            }
            if (height > py + 2)
            {
                // If the 'starting' point was below ground set a flag to indicate that. If the line of sight goes above the terrain and does not get intersected then the point can be treated as being in sight (ie can be seen from underneath the 'ground').
                if (i == 0)
                {
                    started_below_ground = true;
                }
                else
                {
                    if (started_below_ground == false) return;
                }
            }
            else
            {
                started_below_ground = false;
            }
        }

        return true;
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


    /** Event Handling */

    /**
     * Adds an event listener
     * @param {string} event 
     * @param {function} callback 
     */
    add_event_listener(event, callback)
    {
        if (this.#event_handlers[event] == undefined) this.#event_handlers[event] = [];
        if (this.#event_handlers[event].indexOf(callback) == -1) this.#event_handlers[event].push(callback);
    }

    /**
     * Removes an event listener
     * @param {string} event 
     * @param {function} callback 
     */
    remove_event_listener(event, callback)
    {
        if (this.#event_handlers[event])
        {
            let index = this.#event_handlers[event].indexOf(callback);
            if (index != -1) this.#event_handlers[event].splice(index, 1);
            if (this.#event_handlers[event].length == 0) delete this.#event_handlers[event];
        }
    }

    /**
     * Dispatches an event by calling all registered callbacks.
     * @param {string} event The event to dispatch
     * @param {object} params The parameters object to pass to the callback
     */
    dispatch_event(event, params)
    {
        if (this.#event_handlers[event])
        {
            for (let func of this.#event_handlers[event])
            {
                func(params);
            }
        }
    }


}

export {Project};
