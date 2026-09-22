import { Helper } from './helper.js';
import { MaterialManager } from './material_manager.js';
import * as THREE from './three.module.min.js';

class TerrainChunk
{
    /**
     * The ThreeJS scene object that the chunk will be added to.
     */
    scene;

    /**
     * The information for this terrain chunk.
     * @type {TerrainChunkInfo}
     */
    info;
   
    /**
     * The arraybuffer containing the height data.
     */
    data_buffer;

    /**
     * The terrain mesh.
     */
    mesh = undefined;

    mesh_center = new THREE.Vector3();

    texture = undefined;

    /**
     * List of features that should be displayed.
     */
    features = undefined;

    /**
     * DOM canvas element for this chunk. Only generated when features are applied.
     */
    #canvas_el = undefined;
    
    /**
     * 
     * @param {THREE.Scene} scene The scene to which the chunk will be added.
     * @param {TerrainChunkInfo} info Information about the chunk. This needs to provide: position (.x, .y), size (.w, .h), lod, 
     * @param {ArrayBuffer} data The array buffer that contains the height data.
     */
    constructor(scene, info, data)
    {
        this.scene = scene;
        this.info = info;
        this.data_buffer = data;
        this.#generate_chunk();
    }


    #generate_chunk()
    {
        const view = new DataView(this.data_buffer);
        if (this.info.lod < this.info.native_resolution) this.info.lod = this.info.native_resolution;
        let width = this.info.size.w;
        let height = this.info.size.h;
        let segments_w = this.info.size.w / this.info.lod;
        let segments_h = this.info.size.h / this.info.lod;
        window._data.profiler.start_section('create geometry');
        var geometry = this.#create_or_copy_plane(width, height, segments_w, segments_h);
        window._data.profiler.end_section('create geometry');
        let pos = geometry.getAttribute('position');
        let index = 0;
        let height_mult = 1;
        let bx = 0;
        let by = 0;
        let val = 0;
        let min = 100000;
        let max = -100000;

        window._data.profiler.start_section('set vertex values');
        for (let row = 0; row < segments_h + 1; row++)
        {
            for (let col = 0; col < segments_w + 1; col++)
            {
                index = (row * (segments_w + 1) + col) * 3;
                bx = this.info.data_offset.x + col * this.info.lod / this.info.native_resolution;
                by = this.info.data_offset.y * this.info.data_size.h + row * this.info.lod / this.info.native_resolution * this.info.data_size.h;
                try {
                    val = view.getUint16((bx + by) * 2);
                }catch(e){
                    console.log(col, row, bx, by);
                    throw new Error('oops');
                }

                let elevation = val / 10 * height_mult;
                pos.array[index + 1] = elevation;
                if (elevation > max) max = elevation;
                if (elevation < min) min = elevation;
            }
        }
        window._data.profiler.end_section('set vertex values');
        
        // let colours = {
        //     1: {r: 1, g: 0, b: 0},
        //     2: {r: 1, g: 1, b: 0},
        //     4: {r: 0, g: 1, b: 0},
        //     10: {r: 0, g: 1, b: 1},
        //     20: {r: 0, g: 0, b: 1}
        // };
        // let color = colours[this.info.lod] ?? {r: 0.8, g: 0.8, b: 0.8};
        // color = {r: 1, g: 1, b: 1};
        // var material = new THREE.MeshPhongMaterial({
        //     color: new THREE.Color(color.r, color.g, color.b),
        //     emissive: new THREE.Color(0.05, 0.05, 0.05),
        //     specular: new THREE.Color(0.02, 0.02, 0.02),
        //     shininess: 70,
        //     flatShading: true,
        //     //wireframe: true
        // });

        // If features exist they need to be rendered to the canvas. A texture is then generated and applied to the material.
        if (this.features !== undefined)
        {
            window._data.profiler.start_section('render features');
            Helper.app.project.feature_manager.render_canvas(`${this.info.coordinate.x}:${this.info.coordinate.y}`, this.#canvas_el, this.info.lod / this.info.native_resolution);
            this.texture = new THREE.CanvasTexture(this.#canvas_el);
            window._data.profiler.end_section('render features');
            console.log('regen texture');
        }
        
        //console.info(this.info, this.texture);
        let uniforms = {
            lineThickness: { value: 1 },
            iChannel0: { value: this.texture }
        }
        let m = new THREE.MeshPhongMaterial({
            color: new THREE.Color(1.5, 1.5, 1.5),
            emissive: new THREE.Color(0.05, 0.05, 0.05),
            specular: new THREE.Color(0.02, 0.02, 0.02),
            shininess: 70,
            flatShading: true,
            //transparent: true,
            map: this.texture,
            onBeforeCompile: shader => {
                shader.uniforms.lineThickness = uniforms.lineThickness;
                shader.uniforms.iChannel0 = uniforms.iChannel0;
                shader.vertexShader = `
                varying vec3 vPos;
                varying vec2 vUv;
              ${shader.vertexShader}
            `.replace(
                    `#include <begin_vertex>`,
                    `#include <begin_vertex>
                vPos = transformed;
                // Pass the geometry's UV coordinates to the fragment shader
                vUv = uv;
              `
                );
                shader.fragmentShader = `
              uniform float lineThickness;
              uniform sampler2D iChannel0;
              varying vec3 vPos;
              // Received from the vertex shader (interpolated across the face)
              varying vec2 vUv; 
              ${shader.fragmentShader}
            `.replace(
                    `#include <dithering_fragment>`,
                    `
                vec3 col = gl_FragColor.rgb;

                // *** For applying colours based on height. ***
                // Normalize height between 0.0 and 1.0. 2000m will cover all of Australia.
                float h = (vPos.y - 0.0) / (2000.0 - 0.0);
                vec3 white = vec3(1.0, 1.0, 1.0);
                vec3 blue = vec3(0.53, 0.76, 1.0);
                vec3 green = vec3(0.0, 0.5, 0.0);
                vec3 yellow  = vec3(0.5, 0.5, 0.0);
                vec3 red  = vec3(0.5, 0.0, 0.0);
                vec3 gray  = vec3(0.5, 0.5, 0.5);
                vec3 gradcol = white;
                // Blend colour based on heights.
                gradcol = mix(gradcol, blue, smoothstep(0.0, 0.16, h));
                gradcol = mix(gradcol, green,  smoothstep(0.16, 0.32, h));
                gradcol = mix(gradcol, yellow,  smoothstep(0.32, 0.48, h));
                gradcol = mix(gradcol, red,  smoothstep(0.48, 0.64, h));
                gradcol = mix(gradcol, gray,  smoothstep(0.64, 0.8, h));
                gradcol = mix(gradcol, white,  smoothstep(0.8, 1.0, h));

                // *** Apply contours
                vec3 lineCol = vec3(0.5, 0.5, 0.5);
                if (mod(vPos.y, 10.0) < lineThickness * 0.1) {
                    col = lineCol;
                }
                if (mod(vPos.y, 100.0) < lineThickness * 0.5) {
                    lineCol = vec3(0.4, 0.4, 0.4);
                    col = lineCol;
                }
                
                // *** Apply the colour gradient now. Could also be done before applying the contours.
                col = mix(col, gradcol, 0.25);

                // *** Apply texture with the features. If there is no feature texture then this does nothing.
                // Smoothly blend the background color and texture color using the alpha channel
                // If texcol.a is 0.0, it uses col. If 1.0, it uses texcol.rgb
                vec4 texcol = texture2D(iChannel0, vUv);
                col = mix(col, texcol.rgb, texcol.a);
                
                gl_FragColor = vec4( col, 1);
              `
                );
            }
        });
        //m.defines = { "USE_UV": "" };
        //m.extensions = { derivatives: true };
        window._data.profiler.start_section('create mesh and add to scene');
        //let m = MaterialManager.get_material(Helper.app.are_contours_visible() ? 'terrain-contours' : 'terrain');
        this.mesh = new THREE.Mesh(geometry, m);
        this.mesh.position.set(this.info.position.x + width / 2, 0, this.info.position.y - height / 2);
        this.mesh_center = new THREE.Vector3(this.info.position.x + this.info.size.w / 2, (min + max) / 2, this.info.position.y - this.info.size.h / 2);    // Need to know the position of the bounding box center for LOD functionality.
        this.mesh.layers.enable(1);      // all terrain meshes must be a member of layer 1. Needed for terrain raycasting.
        //this.mesh.geometry.computeVertexNormals();
        this.scene.add(this.mesh);

        window._data.profiler.end_section('create mesh and add to scene');

    }

    update_lod(lod)
    {
        window._data.profiler.start_section('remove mesh');
        this.scene.remove(this.mesh);
        
        this.mesh.geometry.dispose();
        this.mesh.material.dispose();
        if (this.texture)
        {
            //console.log('dispose of texture', this.texture.id);
            this.texture.dispose();
        }
        this.mesh = undefined;
        this.info.lod = lod;
        window._data.profiler.end_section('remove mesh');
        this.#generate_chunk();
    }

    /**
     * Removes this chunk's mesh.
     */
    destroy()
    {
        this.scene.remove(this.mesh);
        this.mesh.geometry.dispose();
        this.mesh.material.dispose();
        this.mesh = undefined;
        // Remove canvas if one was created.
        if (this.#canvas_el !== undefined) this.#canvas_el.remove();
    }

    // Creates a plane or copies from an existing one.
    #create_or_copy_plane(width, height, segments_w, segments_h)
    {
        const key = width + '_' + height + '_' + segments_w + '_' + segments_h;

        if (window._data.planes == undefined) window._data.planes = {};
        if (window._data.planes[key] == undefined)
        {
            let geometry = new THREE.PlaneGeometry(width, height, segments_w, segments_h);
            // Make the plane horizontal.
            geometry.rotateX(Math.PI * -0.5);
            window._data.planes[key] = geometry.clone();
            console.log('created plane for cloning', key);
            return geometry;
        }
        return window._data.planes[key].clone();
    }

    /**
     * Set the material for this chunk's mesh.
     * @param {THREE.Material} material 
     */
    set_material(material)
    {
        this.mesh.material = material;
    }

    /**
     * Sets features to display on the chunk.
     * @param {object} features 
     */
    set_features(features)
    {
        if (this.#canvas_el === undefined)
        {
            // Create a canvas for this chunk. The width/height are dependent on the lod of the chunk.
            let el = document.createElement('canvas');
            el.id = `${this.info.coordinate.x}:${this.info.coordinate.y}`;
            el.height = this.info.size.w / this.info.lod;      // number of pixel rows in the canvas
            el.width = this.info.size.h / this.info.lod;       // number of pixel columns in the canvas
            let container = document.getElementById('texture_canvases');
            container.appendChild(el);
            this.#canvas_el = el;
            console.info('creating canvas for ' + el.id);
        }
        this.features = features;
        //this.#generate_chunk(); // regenerate with the new features.
    }

}

/**
 * Information for initialising a terrain chunk.
 */
class TerrainChunkInfo
{
    /**
     * Coordinate of the bottom left corner of the terrain chunk.
     */
    coordinate = {x: 0, y: 0};

    /**
     * Position of chunk along the grid axis. Position defines the bottom left corner of the chunk.
     */
    position = {x: 0, y: 0}; 

    /**
     * The size of the chunk in meters.
     */
    size = {w: 0, h: 0};

    /**
     * The current LOD. This value is multiplied with the native_resolution when reading from a data buffer.
     */
    lod = 1;

    /**
     * The data resolution in meters. 1 means that each point in the data is 1m from the next. The resolution at which data is actually read from the buffer depends on the LOD level set.
     */
    native_resolution = 1;

    /**
     * Is this chunk visible?
     */
    is_visible = true;

    /**
     * The number of columns/rows in the data buffer.
     */
    data_size = {w: 0, h: 0};

    /**
     * The offset (column/row) to use when reading the data buffer.
     */
    data_offset = {x: 0, y: 0};

    constructor() {}
}

export {TerrainChunk, TerrainChunkInfo};