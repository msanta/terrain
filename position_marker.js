
import * as THREE from './three.module.min.js';

/**
 * Represents an sphere that shows a position.
 */
class PositionMarker
{
    /**
     * The mesh object
     */
    mesh;

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
        this.scene = scene;
        scene.add(this.mesh);
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
     * Removes this marker's mesh.
     */
    destroy()
    {
        this.scene.remove(this.mesh);
        this.mesh.geometry.dispose();
        this.mesh.material.dispose();
        this.mesh = undefined;
    }
}

export {PositionMarker};
