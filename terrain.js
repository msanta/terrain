import * as THREE from 'three'
import { TerrainChunk, TerrainChunkInfo } from './terrain_chunk.js';
import { Vector3 } from './three.module.min.js';

class Terrain
{
    #scene;
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
        let chunks_x = (this.info.data_size.w - 1) / this.info.chunk_size;
        let chunks_y = (this.info.data_size.h - 1) / this.info.chunk_size;
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
                    x: this.info.chunk_size * y,
                    y: this.info.chunk_size * x
                };
                TCI.native_resolution = this.info.native_resolution;
                TCI.lod = 20;
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

        let levels = {1400: 1, 2200: 2, 4000: 4, 8000: 8, 10000: 10};
        //let levels = {2000: 1, 8000: 2, 20000: 4};
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
                for (let l in levels)
                {
                    if (dist <= l)
                    {
                        use_lod = levels[l];
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
        console.log('in bb: ', inbb.length, 'update: ', updated.length, 'Time taken: ', end - start);
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