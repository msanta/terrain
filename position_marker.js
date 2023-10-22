
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

export {PositionMarker, GPSPositionMarker};
