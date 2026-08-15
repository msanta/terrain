import * as THREE from 'three';
import { Material } from './three.module.min.js';

class MaterialManager {
    /**
     * @type {object<string,Material>}
     */
    static materials = {};

    /**
     * Create initial materials.
     */
    static {
        let mat = new THREE.MeshPhongMaterial({
            color: new THREE.Color(1, 1, 1),
            emissive: new THREE.Color(0.05, 0.05, 0.05),
            specular: new THREE.Color(0.02, 0.02, 0.02),
            shininess: 70,
            flatShading: true,
            //wireframe: true
        });
        this.materials['terrain'] = mat;

        let matvals = {lineThickness: { value: 1 }}
        mat = new THREE.MeshPhongMaterial({
            color: new THREE.Color(1, 1, 1),
            emissive: new THREE.Color(0.05, 0.05, 0.05),
            specular: new THREE.Color(0.02, 0.02, 0.02),
            shininess: 70,
            flatShading: true,
            wireframe: false,
            onBeforeCompile: shader => {
                shader.uniforms.lineThickness = matvals.lineThickness;
                shader.vertexShader = `
                varying vec3 vPos;
              ${shader.vertexShader}
            `.replace(
                    `#include <begin_vertex>`,
                    `#include <begin_vertex>
                vPos = transformed;
              `
                );
                shader.fragmentShader = `
              uniform float lineThickness;
              varying vec3 vPos;
              ${shader.fragmentShader}
            `.replace(
                    `#include <dithering_fragment>`,
                    `
                vec3 col = gl_FragColor.rgb;
                vec3 lineCol = vec3(0.5, 0.5, 0.5);
                if (mod(vPos.y, 10.0) < lineThickness * 0.1) {
                    col = lineCol;
                }
                if (mod(vPos.y, 100.0) < lineThickness * 0.5) {
                    lineCol = vec3(0.4, 0.4, 0.4);
                    col = lineCol;
                }
                gl_FragColor = vec4( col, opacity);
              `
                );
            }
        });
        mat.defines = { "USE_UV": "" };
        mat.extensions = { derivatives: true };
        this.materials['terrain-contours'] = mat;
    }

    /**
     * Gets a material. If not found returns null.
     * @param {string} name The material name.
     * @return {Material|null}
     */
    static get_material(name) {
        if (this.materials[name] !== undefined) return this.materials[name];
        return null;
    }
}

export { MaterialManager };