
import * as THREE from './three.module.min.js';

/**
 * Represents a sphere that shows a position.
 */
class PositionMarker
{
    /**
     * The mesh object
     */
    mesh;

    /**
     * A html element that acts as the marker's label.
     */
    label_el;

    /**
     * The scene that this marker is added to.
     */
    scene;

    is_visible;

    #label_width;
    #label_height;
    #label_state_change;

    /**
     * 
     * @param {THREE.Scene} scene The scene to which the marker will be added.
     * @param {THREE.Vector3} position The position of the marker.
     * @param {float} radius The radius of the sphere.
     */
    constructor(scene, position = new THREE.Vector3(), radius = 1)
    {
        const geometry = new THREE.SphereGeometry(radius, 10, 10); 
        const material = new THREE.MeshBasicMaterial({color: 0x00ff00});
        material.transparent = true;
        material.opacity = 0.5;
        this.mesh = new THREE.Mesh(geometry, material);
        this.mesh.position.set(position.x, position.y, position.z);
        this.mesh.layers.enable(2);     // All marker meshes belong to layer 2.
        this.scene = scene;
        scene.add(this.mesh);
        this.is_visible = false;
        this.#label_state_change = 0;
    }


    set_label(name)
    {
        let labels_container = document.getElementById('labels');       // TODO: find a way to specify the labels container
        const elem = document.createElement('div');
        elem.textContent = name;
        elem.id = "_label_" + name;
        labels_container.appendChild(elem);
        this.label_el = elem;
        this.#label_width = elem.clientWidth;
        this.#label_height = elem.clientHeight;
    }

    update_label_position(camera, renderer_width, renderer_height)
    {
        let visible = false;
        
        //this.mesh.updateWorldMatrix( true, false );  <-- not sure what this does. Doesn't seem to affect the outcome?
        //this.mesh.getWorldPosition( tempV );  <-- why this rather then just mesh.position ?
        let tempV = this.mesh.position.clone();

        // Only show the marker label if the marker is within 2km of the camera.
        let limit = 20000;
        let dist = tempV.distanceTo(camera.position);
        if (dist < limit)
        {
            visible = true;
            // get the normalized screen coordinate of that position
            // x and y will be in the -1 to +1 range with x = -1 being
            // on the left and y = -1 being on the bottom
            tempV.project(camera);
           
            // convert the normalized position to CSS coordinates
            const x = (tempV.x *  .5 + .5) * renderer_width;
            const y = (tempV.y * -.5 + .5) * renderer_height;
        
            // Is there free space to position the label?
            if (Math.abs(tempV.z) > 1) visible = false;
            if (visible)
            {
                //console.log('check label at', x - this.#label_width / 2, y + this.#label_height, this.#label_width, this.#label_height);
                if (ScreenSpace.is_free(x - this.#label_width / 2, y + this.#label_height, this.#label_width, this.#label_height))
                {
                    ScreenSpace.mark_as_occupied(x - this.#label_width / 2, y + this.#label_height, this.#label_width, this.#label_height);

                    // move the elem to that position
                    this.label_el.style.transform = `translate(-50%, -50%) translate(${x}px,${y}px)`;
                    // set the zIndex for sorting
                    this.label_el.style.zIndex = (-tempV.z * .5 + .5) * 100000 | 0;
                    // make elements further away more transparent.
                    //this.label_el.style.opacity = (1000 + (limit - dist)) / limit;
                }
                else
                {
                    visible = false;
                }
            }
        }
        if (!visible || Math.abs(tempV.z) > 1)
        {
            // if (this.#label_state_change > -10) this.#label_state_change--;
            // if (this.#label_state_change == -10)
            // {
                // hide the label
                this.label_el.style.opacity = 0;
                this.label_el.className = 'fadeout';
                this.#label_state_change = 0;
            // }
        }
        if (visible)
        {
            if (this.#label_state_change < 5) this.#label_state_change++;
            if (this.#label_state_change == 5)
            {
                this.label_el.style.opacity = 1;
                this.label_el.className = 'fadein';
            }
        }
        this.is_visible = visible;
    }

    /**
     * Sets the position of the marker.
     * @param {THREE.Vector3} position 
     */
    set_position(position = new THREE.Vector3())
    {
        this.mesh.position.set(position.x, position.y, position.z);
    }

    /**
     * Sets the size (diameter) of the marker.
     * @param {float} size This will be the new diameter of the marker.
     */
    set_size(size)
    {
        this.mesh.scale(size, size, size);
    }

    /**
     * Sets the visibility.
     * @param {bool} is_visible 
     */
    visible(is_visible)
    {
        this.mesh.visible = is_visible;
    }

    /**
     * Removes this marker's mesh.
     */
    destroy()
    {
        this.scene.remove(this.mesh);
        this.mesh.geometry.dispose();
        this.mesh.material.dispose();
        this.mesh = undefined;
        if (this.label_el) this.label_el.remove();
    }
}

/**
 * Represents a sphere to show position and a cylinder around the sphere to show accuracy of the position.
 */
class GPSPositionMarker extends PositionMarker
{
    /**
     * Mesh for displaying the accuracy
     */
    accuracy_mesh;

    /**
     * 
     * @param {THREE.Scene} scene The scene to which the marker will be added.
     * @param {THREE.Vector3} position The position of the marker.
     * @param {float} radius The radius of the position sphere.
     */
    constructor(scene, position = new THREE.Vector3(), radius = 1)
    {
        super(scene, position, radius);

        const geometry = new THREE.CylinderGeometry(0.5, 0.5, 20, 20, 1, true);     // Diameter of 1.
        const material = new THREE.MeshBasicMaterial({color: 0xffff00});
        material.transparent = true;
        material.opacity = 0.25;
        material.side = THREE.DoubleSide;
        this.accuracy_mesh = new THREE.Mesh(geometry, material);
        this.accuracy_mesh.position.set(position.x, position.y, position.z);
        this.scene = scene;
        scene.add(this.accuracy_mesh);
    }

    /**
     * Sets the position of the marker and its accuracy.
     * @param {THREE.Vector3} position
     * @param {number} accuracy A positive value in meters. This will determine the size of the accuracy sphere for this marker.
     */
    set_position(position = new THREE.Vector3(), accuracy = 0)
    {
        super.set_position(position);

        // limit to 50m, as any larger makes no sense for display purposes.
        if (accuracy > 50) accuracy = 50;
        accuracy *= 2;      // remember to double for drawing the sphere!
        this.accuracy_mesh.position.set(position.x, position.y, position.z);
        let height_scale = accuracy / 100;
        if (height_scale < 0.1) height_scale = 0.1;
        this.accuracy_mesh.scale.set(accuracy, height_scale, accuracy);
    }

    /**
     * Sets the visibility.
     * @param {bool} is_visible
     */
    visible(is_visible)
    {
        super.visible(is_visible);

        this.accuracy_mesh.visible = is_visible;
    }

    /**
     * Removes this marker's mesh.
     */
    destroy()
    {
        super.destroy();

        this.scene.remove(this.accuracy_mesh);
        this.accuracy_mesh.geometry.dispose();
        this.accuracy_mesh.material.dispose();
        this.accuracy_mesh = undefined;
    }

}


class ScreenSpace
{
    static occupied;
    static width;
    static height;

    static reset(width, height)
    {
        this.width = Math.ceil(width / 10);
        this.height = Math.ceil(height / 10);
        this.occupied = new Uint8Array(this.width * this.height);
    }

    static is_free(posx, posy, width, height)
    {
        posx = Math.ceil(posx / 10);
        posy = Math.ceil(posy / 10);
        width = Math.ceil(width / 10);
        height = Math.ceil(height / 10);
        let index;
        for (let x = posx; x < posx + width; x++)
        {
            for (let y = posy; y < posy + height; y++)
            {
                index = x + y * this.width;
                if (this.occupied[index]) return false;
            }
        }
        return true;
    }

    static mark_as_occupied(posx, posy, width, height)
    {
        posx = Math.ceil(posx / 10);
        posy = Math.ceil(posy / 10);
        width = Math.ceil(width / 10);
        height = Math.ceil(height / 10);
        let index;
        for (let x = posx; x < posx + width; x++)
        {
            for (let y = posy; y < posy + height; y++)
            {
                index = x + y * this.width;
                this.occupied[index] = 1;
            }
        }
    }

}


export {PositionMarker, GPSPositionMarker, ScreenSpace};
