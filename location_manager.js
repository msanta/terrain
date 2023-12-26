import * as THREE from 'three'
import { Helper } from "./helper.js";
import { KML } from "./kml.js";
import { PositionMarker, ScreenSpace } from "./position_marker.js";
import { Project } from "./project.js";
import { Vector3 } from './three.module.min.js';

/**
 * Class for managing locations. This allows for adding, removing, showing and hiding.
 */
class LocationManager
{
    /**
     * @type {Array} List of markers loaded.
     */
    #markers;

    /**
     * @type {Project} The project that this location manager is bound to.
     */
    #project;

    /**
     * @type {THREE.Scene} The THREE scene instance
     */
    #scene;

    /**
     * @type {number} The UTM zone of the associated project.
     */
    #utm_zone;

    /**
     * Create a new Location Manager instance. Must be provided with a project and scene object.
     * @param {Project} project The project that this location manager is bound to.
     * @param {THREE.Scene} scene The THREE scene instance
     */
    constructor(project, scene)
    {
        this.#project = project;
        this.#scene = scene;
        this.#markers = [];
        this.#utm_zone = project.get_utm_zone();
    }

    /**
     * Load locations from a KML instance.
     * @param {KML} kml
     */
    load_locations_from_kml(kml)
    {
        for (let folder in kml.locations)
        {
            for (let location of kml.locations[folder])
            {
                //console.log(location);
                let utm = Helper.convert_latlon_to_utm(location.lat, location.lon, this.#utm_zone);
                let x = utm.easting - this.#project.project_info.origin.x;
                let z = utm.northing - this.#project.project_info.origin.y;
                let y = this.#project.get_terrain_height_at_location2(x, -z);
                if (y == -9999) continue;   // skip as there is no terrain to place the marker on.
                let marker = new PositionMarker(this.#scene, new Vector3(x, y, -z), 3);
                if (location.name !== '') marker.set_label(location.name);
                this.#markers.push(marker);
                //console.log(location.name, x,y,-z);
            }
        }
    }

    update_marker_labels(camera, display_width, display_height)
    {
        let start = Date.now();
        // Clear the screen space (2D) label occupancy
        ScreenSpace.reset(display_width, display_height);
        // For working out if the marker is in the frustrum
        const frustum = new THREE.Frustum();
        frustum.setFromProjectionMatrix(camera.projectionMatrix)
        frustum.planes.forEach(function(plane) { plane.applyMatrix4(camera.matrixWorld) })
        let cnt = 0;
        for (let marker of this.#markers)
        {
            let bb = new THREE.Box3().setFromObject(marker.mesh);
            if(frustum.intersectsBox(bb)) 
            {
                if (!this.#project.in_line_of_sight(camera.position, marker.mesh.position, 2000))
                {
                    marker.is_visible = false;
                    marker.label_el.style.opacity = 0;
                }
                else
                {
                    marker.update_label_position(camera, display_width, display_height);
                }
            }
            else if (marker.label_el)
            {
                marker.is_visible = false;
                marker.label_el.style.opacity = 0;
            }
            //if (cnt++ > 0) break;
            if (marker.is_visible) cnt++;
        }
        let end = Date.now();
        console.log('updating markers took ' + (end - start) + 'ms', 'visible: ', cnt);
    }

    destroy()
    {
        //need to remove existing locations
        for (let marker of this.#markers)
        {
            marker.destroy();
        }
        this.#markers = [];
    }

    search_locations(search)
    {
        let matches = [];
        let regex = new RegExp(search, 'i');
        if (this.#markers)
        {
            for (let location of this.#markers)
            {
                if (regex.test(location.label_text))
                {
                    matches.push(location);
                }
            }
        }
        // console.log('found:', matches);
        return matches;
    }

    find_location_by_name(name)
    {
        for (let location of this.#markers)
        {
            if (location.label_text == name) return location;
        }
    }


}

export {LocationManager};
