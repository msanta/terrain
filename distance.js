import * as THREE from './three.module.min.js';

/**
 * Shows a scale bar on the screen. The scale bar is based on the terrain distance at the location of the scale bar watch area.
 */
class ScaleBar
{
    /**
     * The scalebar container element
     */
    #container_el;

    /**
     * The scalebar element. This is a div element showing left, bottom and right border.
     */
    #scalebar_el;

    /**
     * The element that displays the scale number.
     */
    #value_el;

    /**
     * Creates a new scale bar at the given position and with a given size. NOTE: CSS must exist for the scalebar UI elements to be positioned and sized appropriately.
     */
    constructor()
    {
        const gui = document.getElementById('gui');
        let el = document.createElement('div');
        el.id = "scalebar_container";
        el.className = "scalebar_container";
        this.#container_el = el;
        gui.appendChild(this.#container_el);

        el = document.createElement('div');
        el.id = "scalebar";
        el.className = "scalebar";
        this.#scalebar_el = el;
        this.#container_el.appendChild(this.#scalebar_el);

        el = document.createElement('div');
        el.id = "scalebar_val";
        el.className = "scalebar_value";
        el.innerText = "100m";
        this.#value_el = el;
        this.#container_el.appendChild(this.#value_el);
    }

    /**
     * Updates the scalebar. The scalebar is dependent on terrain being located under the scalebar UI element. If there is no terrain then nothing will show. NOTE: Only call this function after the camera has been moved because it performs two raycasts.
     * @param {THREE.Camera} camera 
     * @param {THREE.Scene} scene 
     * @param {integer} viewport_width 
     * @param {integer} viewport_height 
     * @returns void
     */
    update(camera, scene, viewport_width, viewport_height)
    {
        const raycaster = new THREE.Raycaster();
        raycaster.layers.set(1);    // only test against terrain meshes

        const rect = this.#container_el.getBoundingClientRect();
        // Get the position on the terrain at the start and end of the container element along the bottom edge.
        let p1 = {x: rect.left, y: rect.bottom};
        let p2 = {x: rect.right, y: rect.bottom};
        // Normalise coordinates to be between -1 and 1
        p1.x = (p1.x / viewport_width) * 2 - 1;
        p1.y = - (p1.y / viewport_height) * 2 + 1;
        p2.x = (p2.x / viewport_width) * 2 - 1;
        p2.y = - (p2.y / viewport_height) * 2 + 1;

        raycaster.setFromCamera( p1, camera );

        // calculate objects intersecting the two points on the scalebar.
        let intersects = raycaster.intersectObjects(scene.children);
        if (intersects.length == 0)
        {
            this.hide();
            return;
        }
        let point1 = intersects[0].point;

        raycaster.setFromCamera( p2, camera );
        intersects = raycaster.intersectObjects(scene.children);
        if (intersects.length == 0)
        {
            this.hide();
            return;
        }
        let point2 = intersects[0].point;


        let dist = {x: point1.x - point2.x, z: point1.z - point2.z};
        dist = Math.sqrt(dist.x * dist.x + dist.z * dist.z);
        
        // Update the size of the scalebar and text. The scalebar should show the nearest 1 / 10 / 100 / 1000 / 10000 meters that can fit within the bounds of the scalebar container.
        let value = 0;
        if (dist <= 10) // round down to nearest meter
        {
            value = Math.floor(dist);
        }
        else if (dist <= 100)    // round down to nearest 10m
        {
            value = Math.floor(dist / 10) * 10;
        }
        else if (dist <= 1000)   // round down to nearest 100m
        {
            value = Math.floor(dist / 100) * 100;
        }
        else if (dist <= 100000)  // round down to nearest 1000m
        {
            value = Math.floor(dist / 1000) * 1000;
        }

        let scale = value / dist;
        this.#value_el.textContent = value + 'm';
        this.#scalebar_el.style.width = (rect.width * scale) + 'px';
        this.show();
    }

    hide()
    {
        this.#container_el.style.opacity = 0;
    }

    show()
    {
        this.#container_el.style.opacity = 1;
    }

}

export {ScaleBar};
