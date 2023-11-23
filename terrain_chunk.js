import * as THREE from './three.module.min.js';

class TerrainChunk
{
    /**
     * The ThreeJS scene object that the chunk will be added to.
     */
    scene;

    /**
     * The information for this terrain chunk.
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
    
    /**
     * 
     * @param {THREE.Scene} scene The scene to which the chunk will be added.
     * @param {TerrainChunkInfo} info Information about the chunk. This needs to provide: position (.x, .y), size (.w, .h), lod_level, 
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
        
        let colours = {
            1: {r: 1, g: 0, b: 0},
            2: {r: 1, g: 1, b: 0},
            4: {r: 0, g: 1, b: 0},
            10: {r: 0, g: 1, b: 1},
            20: {r: 0, g: 0, b: 1}
        };
        let color = colours[this.info.lod] ?? {r: 0.8, g: 0.8, b: 0.8};
        color = {r: 1, g: 1, b: 1};
        var material = new THREE.MeshPhongMaterial({
            color: new THREE.Color(color.r, color.g, color.b),
            emissive: new THREE.Color(0.05, 0.05, 0.05),
            specular: new THREE.Color(0.02, 0.02, 0.02),
            shininess: 70,
            flatShading: true,
            //wireframe: true
        });
        window._data.profiler.start_section('create mesh and add to scene');
        this.mesh = new THREE.Mesh(geometry, material);
        this.mesh.position.set(this.info.position.x + width / 2, 0, this.info.position.y - height / 2);
        this.mesh_center = new THREE.Vector3(this.info.position.x + this.info.size.w / 2, (min + max) / 2, this.info.position.y - this.info.size.h / 2);    // Need to know the position of the bounding box center for LOD functionality.
        this.mesh.layers.enable(1);      // all terrain meshes must be a member of layer 1. Needed for terrain raycasting.
        
        this.scene.add(this.mesh);

        window._data.profiler.end_section('create mesh and add to scene');

    }

    update_lod(lod)
    {
        window._data.profiler.start_section('remove mesh');
        this.scene.remove(this.mesh);
        
        this.mesh.geometry.dispose();
        this.mesh.material.dispose();
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

}

/**
 * Information for initialising a terrain chunk.
 */
class TerrainChunkInfo
{
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