import * as THREE from 'three'
import { TerrainChunk, TerrainChunkInfo } from './terrain_chunk.js';
import { Vector3 } from './three.module.min.js';

class Terrain
{
    /**
     * The ThreeJS scene object that the chunk will be added to.
     */
    scene;

    /**
     * The information used for generating this terrain chunk.
     */
    info;
   
    /**
     * The arraybuffer containing the height data.
     */
    data_buffer;

    /**
     * The terrain chunks that make up this terrain.
     */
    chunks = [];
    
    
    /**
     * 
     * @param {THREE.Scene} scene The scene to which the terrain will be added.
     * @param {TerrainInfo} info Information about the terrain.
     * @param {ArrayBuffer} data The array buffer that contains the height data. 
     */
    constructor(scene, info, data)
    {
        this.scene = scene;
        this.info = info;
        this.data_buffer = data;
        this.#generate_terrain();
    }

    #generate_terrain()
    {
        // Generate chunks for the terrain.
        let chunks_x = this.info.size.w / this.info.chunk_size;
        let chunks_y = this.info.size.h / this.info.chunk_size;
        for (let x = 0; x < chunks_x; x++)
        {
            for (let y = 0; y < chunks_y; y++)
            {
                let TCI = new TerrainChunkInfo();
                TCI.data_size = this.info.data_size;
                TCI.size = {w: this.info.chunk_size, h: this.info.chunk_size};
                TCI.position = {
                    x: this.info.position.x + this.info.chunk_size * y,
                    y: this.info.position.y - this.info.size.h + this.info.chunk_size * (x + 1)
                };
                TCI.data_offset = {
                    x: this.info.chunk_size / this.info.native_resolution * y,
                    y: this.info.chunk_size / this.info.native_resolution * x
                };
                TCI.native_resolution = this.info.native_resolution;
                TCI.lod = 20;
                if (this.info.chunk_size % TCI.lod !== 0)
                {
                    if (this.info.chunk_size % 10 == 0) TCI.lod = 10;
                    else TCI.lod = this.info.chunk_size / 2;            // should always be possible.
                }
                let TC = new TerrainChunk(this.scene, TCI, this.data_buffer);
                this.chunks.push(TC);
            }
        }
    }

    // Called when the camera position is updated.
    camera_position_update(camera)
    {
        // For working out if a mesh is in the frustrum
        const frustum = new THREE.Frustum();
        frustum.setFromProjectionMatrix(camera.projectionMatrix)
        frustum.planes.forEach(function(plane) { plane.applyMatrix4(camera.matrixWorld) })

        let levels = {
            0.5: {500: 0.5, 1000: 1, 2000: 2, 4000: 5, 8000: 10, 20000: 10},
            1: {1400: 1, 2200: 2, 4000: 4, 8000: 8, 10000: 10, 20000: 20},
            2: {3000: 2, 6000: 4, 10000: 8, 20000: 20},
            5: {10000: 5, 20000: 20}
        }
        let pos = camera.position;
        let inbb = [];
        let updated = [];
    let start = Date.now();
        for (let chunk of this.chunks)
        {
            let bb = new THREE.Box3().setFromObject(chunk.mesh);
            if(frustum.intersectsBox(bb)) 
            {
                inbb.push(chunk.mesh);
                // let chunk_pos = new THREE.Vector3(chunk.mesh.position.x, chunk.mesh.position.y + 2000, chunk.mesh.position.z);
                let dist = pos.distanceTo(chunk.mesh_center);
                //console.log(dist);
                let use_lod = this.info.chunk_size / 2;
                for (let l in levels[this.info.native_resolution])
                {
                    if (dist <= l)
                    {
                        use_lod = levels[this.info.native_resolution][l];
                        break;
                    }
                }
                if (chunk.info.lod != use_lod) 
                {
            let _t1 = Date.now();
                    chunk.update_lod(use_lod);
            let _t2 = Date.now();
            // console.log('update chunk took', _t2 - _t1);
                    updated.push(chunk);
                }
            }
        }
    let end = Date.now();
        //console.log('in bb: ', inbb.length, 'update: ', updated.length, 'Time taken: ', end - start);
    }

    /**
     * Destroys this terrain, removing all associated meshes.
     */
    destroy()
    {
        for (let chunk of this.chunks)
        {
            chunk.destroy();
        }
    }

    /**
     * Get the height of the terrain at the given location.
     * @param {integer} x The x position in the scene.
     * @param {integer} z The z position in the scene.
     */
    get_height_at_location(x, z)
    {
        const terrain_x = x - this.info.position.x;
        const terrain_z = Math.abs(z - this.info.position.y);
        const res = this.info.native_resolution;
        const rows = this.info.data_size.h;
        const cols = this.info.data_size.w;
        // Just get the closest height data point. This is fine, as interpolation with adjacent height points will usually not yield much better results.
        const col = Math.round(terrain_x / res);
        const row = Math.round(cols - (terrain_z / res) - 1);
        const view = new DataView(this.data_buffer);
        let val = view.getUint16((row * rows + col) * 2) / 10;
        return val;
    }

}

/**
 * Information for initialising a terrain.
 */
class TerrainInfo
{
    /**
     * Position of terrain along the grid axis. Position defines the bottom left corner of the terrain.
     */
    position = {x: 0, y: 0}; 

    /**
     * The size of the terrain in meters.
     */
    size = {w: 0, h: 0};

    /**
     * The data resolution in meters. 1 means that each point in the data is 1m from the next. The resolution at which data is actually read from the buffer depends on the LOD level set.
     */
    native_resolution = 1;

    /**
     * Is this terrain visible?
     */
    is_visible = true;

    /**
     * The number of columns/rows in the data buffer.
     */
    data_size = {w: 0, h: 0};

    /**
     * The chunk size to use for the terrain in meters. Must be a factor of the data size width and height! 
     */
    chunk_size = 200;

    constructor() {}
}

export { Terrain, TerrainInfo };