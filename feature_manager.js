// Draws features to canvases and can be used to calculate what features apply to a terrain chunk.

import { TerrainChunk } from "./terrain_chunk.js";

class FeatureManager
{
    #map = {
        offset: {
            x: 0, y: 0
        },
        lod: 4,
        chunk_size: 1000
    };
    #features;        // the feature data.
    #container_el;    // DOM element that will hold the canvases.
    /**
     * @type {TerrainChunk[]}
     */
    #chunks;
    #canvases;

    /**
     * Generates canvases for terrain chunks which can be used to draw features.
     * @param {object} map The map settings. Need to know the width, height, offset:{x,y} and chunk_size
     * @param {*} chunks 
     * @param {*} features 
     * @param {*} container_el 
     */
    constructor(map, chunks, features, container_el)
    {
        this.#map = map;
        this.#chunks = chunks;
        this.#features = features;
        this.#container_el = container_el;
        this.#canvases = [];
    }

    apply()
    {
        this.#generate_canvases();
    }
    
    #generate_canvases()
    {
        // Work out the features for each chunk. Generate a canvas list from the chunks and then add features to this canvas list.
        for (let chunk of this.#chunks)
        {
            //let el = document.createElement('canvas');
            //el.id = `${chunk.info.position.x}:${chunk.info.position.y}`;
            //el.height = this.#map.chunk_size / 4;     // number of pixel rows in the canvas
            //el.width = this.#map.chunk_size / 4;      // number of pixel columns in the canvas
            //this.#container_el.appendChild(el);
            let canvas = {
                x: chunk.info.coordinate.x,
                y: chunk.info.coordinate.y,
                w: chunk.info.size.w,
                h: chunk.info.size.h,
                lod: 4,
                //el: el,
                features: []
            }
            this.#canvases[`${chunk.info.coordinate.x}:${chunk.info.coordinate.y}`] = canvas;
            
        }
        //console.log(this.#canvases);
        //this.#add_features_to_canvases();  <-- results in artifacts (issues at chunk boundaries and weird straight lines due to point order being changed somehow??)
        // Loop through the chunks again and add set the features for each one.
        for (let chunk of this.#chunks)
        {
            const key = `${chunk.info.coordinate.x}:${chunk.info.coordinate.y}`;
            //chunk.set_features(this.#canvases[key].features);
            chunk.set_features([]);  // want it to generate a canvas element and then to make a call to the draw function when the chunk is updated.
        }
    }

    /**
     * Iterates through all features and adds them to canvases if the feature crosses the canvas.
     * @return void
     */
    #add_features_to_canvases()
    {
        for (let j = 0; j < this.#features.length; j++)
        {
            let feature = this.#features[j];
            let coords = feature.geometry.coordinates;
            if (feature.geometry.type == 'MultiLineString')
            {
                this.#add_multilinestring_feature_to_canvases(coords, feature, j);
            }
            else if(feature.geometry.type == 'LineString')
            {
                this.#add_linestring_feature_to_canvases(coords, feature, j);
            }
        }
    }

    /**
     * Adds multiline string features to canvases.
     * @param {array} lines Array of lines. Each line is made up of an array of points.
     * @param {object} feature The feature object. Needed to create copies for each canvas.
     * @param {integer} feature_index A number used to identify the feature.
     * @return void
     */
    #add_multilinestring_feature_to_canvases(lines, feature, feature_index)
    {
        // lines is an array of lines that each have a list of points.
        for (let k = 0; k < lines.length; k++)
        {
            let points = lines[k];
            // Process pairs of points. For each pair the line needs to be checked against all canvases. This has to be done because a line can go across many canvases and simply checking if an endpoint is within a canvas is not going to work. The exception here is if both points lie in the same canvas, in which case there is nothing to test.
            let subset = [];
            for (let i = 0; i < points.length - 1; i++)
            {
                const p1 = {x: points[i][0], y: points[i][1]};
                const p2 = {x: points[i+1][0], y: points[i+1][1]};
                const index1 = {x: p1.x - p1.x % this.#map.chunk_size, y: p1.y - p1.y % this.#map.chunk_size};
                const index2 = {x: p2.x - p2.x % this.#map.chunk_size, y: p2.y - p2.y % this.#map.chunk_size};
                const key1 = `${index1.x}:${index1.y}`;
                const key2 = `${index2.x}:${index2.y}`;
                if (key1 === key2)  // both points lie in the same canvas
                {
                    subset[i] = p1;
                    subset[i+1] = p2;
                    let canvas = this.#canvases[key1];
                    if (canvas !== undefined)
                    {
                        // Add points to feature on the canvas.
                        let canvas_feature = canvas.features[feature_index];
                        if (canvas_feature === undefined)
                        {
                            canvas_feature = window.structuredClone(feature);
                            canvas_feature.geometry.coordinates = [];
                        }
                        if (canvas_feature.geometry.coordinates[k] === undefined)
                        {
                            canvas_feature.geometry.coordinates[k] = [];
                        }
                        canvas_feature.geometry.coordinates[k][i] = p1;
                        canvas_feature.geometry.coordinates[k][i+1] = p2;
                        canvas.features[feature_index] = canvas_feature;
                    }
                }
                else  // test all canvases to see if the line crosses them
                {
                    for (let key in this.#canvases)
                    {
                        let canvas = this.#canvases[key];
                        let intersection = this.#does_line_intersect_bounding_box(
                            p1,
                            p2,
                            {x: canvas.x, y: canvas.y},
                            {x: canvas.x + canvas.w, y: canvas.y + canvas.h}
                        );
                        if (intersection)
                        {
                            // Add points to feature on the canvas.
                            subset[i] = p1;
                            subset[i+1] = p2;
                            let canvas_feature = canvas.features[feature_index];
                            if (canvas_feature === undefined)
                            {
                                canvas_feature = window.structuredClone(feature);
                                canvas_feature.geometry.coordinates = [];
                            }
                            if (canvas_feature.geometry.coordinates[k] === undefined)
                            {
                                canvas_feature.geometry.coordinates[k] = [];
                            }
                            canvas_feature.geometry.coordinates[k][i] = p1;
                            canvas_feature.geometry.coordinates[k][i+1] = p2;
                            canvas.features[feature_index] = canvas_feature;
                            
                        }
                    }
                }
            }
        }
    }

    /**
     * Adds a linestring features to canvases.
     * @param {array} points Array of points that make up the line.
     * @param {object} feature The feature object. Needed to create copies for each canvas.
     * @param {integer} feature_index A number used to identify the feature.
     * @return void
     */
    #add_linestring_feature_to_canvases(points, feature, feature_index)
    {
        // Process pairs of points. For each pair the line needs to be checked against all canvases. This has to be done because a line can go across many canvases and simply checking if an endpoint is within a canvas is not going to work. The exception here is if both points lie in the same canvas, in which case there is nothing to test.
        let subset = [];
        for (let i = 0; i < points.length - 1; i++)
        {
            const p1 = {x: points[i][0], y: points[i][1]};
            const p2 = {x: points[i+1][0], y: points[i+1][1]};
            const index1 = {x: p1.x - p1.x % this.#map.chunk_size, y: p1.y - p1.y % this.#map.chunk_size};
            const index2 = {x: p2.x - p2.x % this.#map.chunk_size, y: p2.y - p2.y % this.#map.chunk_size};
            const key1 = `${index1.x}:${index1.y}`;
            const key2 = `${index2.x}:${index2.y}`;
            if (key1 === key2)  // both points lie in the same canvas
            {
                subset[i] = p1;
                subset[i+1] = p2;
                let canvas = this.#canvases[key1];
                if (canvas !== undefined)
                {
                    // Add points to feature on the canvas.
                    let canvas_feature = canvas.features[feature_index];
                    if (canvas_feature === undefined)
                    {
                        canvas_feature = window.structuredClone(feature);
                        canvas_feature.geometry.coordinates = [];
                    }
                    canvas_feature.geometry.coordinates[i] = p1;
                    canvas_feature.geometry.coordinates[i+1] = p2;
                    canvas.features[feature_index] = canvas_feature;
                }
            }
            else  // test all canvases to see if the line crosses them
            {
                for (let key in this.#canvases)
                {
                    let canvas = this.#canvases[key];
                    let intersection = this.#does_line_intersect_bounding_box(
                        p1,
                        p2,
                        {x: canvas.x, y: canvas.y},
                        {x: canvas.x + canvas.w, y: canvas.y + canvas.h}
                    );
                    if (intersection)
                    {
                        // Add points to feature on the canvas.
                        subset[i] = p1;
                        subset[i+1] = p2;
                        let canvas_feature = canvas.features[feature_index];
                        if (canvas_feature === undefined)
                        {
                            canvas_feature = window.structuredClone(feature);
                            canvas_feature.geometry.coordinates = [];
                        }
                        canvas_feature.geometry.coordinates[i] = p1;
                        canvas_feature.geometry.coordinates[i+1] = p2;
                        canvas.features[feature_index] = canvas_feature;
                        
                    }
                }
            }
            
        }
    }

    /**
     * 
     * @param {string} canvas_id 
     * @param {HTMLCanvasElement} canvas_el
     * @param {integer} lod The size of one pixel in metres
     */
    render_canvas(canvas_id, canvas_el, lod)
    {
        let start = Date.now();
        let canvas = this.#canvases[canvas_id];
        canvas.el = canvas_el;
        let draw = false;
        
        lod = lod / 2;  // divide by X to make canvas larger and give higher resolution. lod of 1 = 1m.
        //console.log(lod, canvas.el.id);
        canvas.el.height = this.#map.chunk_size / lod;
        canvas.el.width = this.#map.chunk_size / lod;
        let ctx = canvas.el.getContext('2d');
        //// Fill background for lod visualisation
        //let lod_colours = {0.5: "#cccccc", 1: "#ffffff", 2: "#ffccff", 3: "#ccffff", 4: "#ffffcc"};
        //if (lod_colours[lod] !== undefined) ctx.fillStyle = lod_colours[lod];
        ctx.fillStyle = '#ffffff01';
        ctx.fillRect(0, 0, canvas.el.height, canvas.el.width);
        let offset = {x: canvas.x, y: canvas.y};
        //console.log(canvas, canvas.el.width, canvas.el.height);
        //for (let index in canvas.features)
        for (let feature of this.#features)
        {
            //let feature = canvas.features[index];
            let coords = feature.geometry.coordinates;
            if (feature.geometry.type == 'MultiLineString')
            {
                // coords is an array of lines that each have a list of points.
                for (let line_list of coords)
                {
                    // Note: a route can overly (duplicate) line strings because the route is a collection of line strings. How to handle this since drawing over existing lines is not a good idea.
                    draw = this.set_ctx_style(ctx, feature.feature_class, feature.feature_type, feature.properties.other_tags, lod);
                    if (draw) this.draw_line_list(line_list, ctx, canvas.el, offset);
                }
            }
            else if(feature.geometry.type == 'LineString')
            {
                // coords is a line list that consists of a list of point
                draw = this.set_ctx_style(ctx, feature.feature_class, feature.feature_type, feature.properties.other_tags, lod);
                if (draw) this.draw_line_list(coords, ctx, canvas.el, offset);
            }
        }
        
        let end = Date.now();
        //console.info('Drawing took ' + (end - start) + 'ms.');
    }

    draw_line_list(line_list, ctx, size, offset)
    {
        ctx.beginPath();
        let first = true;
        for (let index in line_list)
        {
            let point = line_list[index];
            let x = point[0] - offset.x;
            let y = point[1] - offset.y;
            x = x * (size.width / this.#map.chunk_size);
            y = size.height - y * (size.height / this.#map.chunk_size);
            if (first)
            {
                ctx.moveTo(x, y);
                first = false;
            }
            else
            {
                ctx.lineTo(x, y);
            }
        }
        ctx.stroke();
    }

    /**
     * Sets the style for drawing the line segment depending on the feature class, type and other info.
     * @param {*} ctx 
     * @param {*} feat_class 
     * @param {*} feat_type 
     * @param {*} other_tags 
     * @param {*} lod
     * @return {true|false} Indicates if the feature should be drawn.
     */
    set_ctx_style(ctx, feat_class, feat_type, other_tags, lod)
    {
        lod = lod / 1.5;    // make lines a bit thicker so they are easier to see from a distance.
        // Default
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 1;
        ctx.setLineDash([]); // solid line

        if (feat_class == 'highway')
        {
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 6;
            if (feat_type == 'steps')
            {
                ctx.strokeStyle = '#424242';
                ctx.setLineDash([2 / lod]);
                ctx.lineWidth = 4;
            }
            else if (feat_type == 'service')
            {
                ctx.strokeStyle = '#ffffff';
                ctx.lineWidth = 4;
            }
            else if (feat_type == 'track')
            {
                ctx.strokeStyle = '#704c2e';
                //ctx.setLineDash([4 / lod, 4 / lod]);
                ctx.lineWidth = 4;
            }
            else if (feat_type == 'footway')
            {
                ctx.strokeStyle = '#666666';
                //ctx.setLineDash([8 / lod, 8 / lod]);
                ctx.lineWidth = 4;
            }
            else if (feat_type == 'path')
            {
                ctx.strokeStyle = '#ffd67e';
                ctx.setLineDash([8 / lod, 8 / lod]);
                ctx.lineWidth = 4;
            }
            else if (feat_type == 'unclassified')
            {
                ctx.strokeStyle = '#ffffff';
                ctx.lineWidth = 6;
            }

            //console.log(feat_type);
        }
        else if (feat_class == 'waterway')
        {
            ctx.strokeStyle = '#77ddffe5';
            ctx.lineWidth = 4;
            if (feat_type == 'river')
            {
                ctx.lineWidth = 8;
            }
            else if (feat_type == 'stream')
            {
                if (other_tags.intermittent == 'yes') 
                {
                    ctx.strokeStyle = '#77ddffaa';
                    ctx.setLineDash([10 / lod]);
                    ctx.lineWidth = 4;
                }
            }
        }
        else if (feat_class == 'route')
        {
            ctx.strokeStyle = '#ff0000';
            ctx.lineWidth = 0;  // don't show unless a specific feature type has been implemented.
            ctx.setLineDash([5 / lod, 15 / lod]);
            if (feat_type == 'railway')
            {
                ctx.lineWidth = 3;
                ctx.strokeStyle = '#000000';
                ctx.setLineDash([1 / lod, 1 / lod]);
            }
            else
            {
                return false;
            }
        }
        ctx.lineWidth = ctx.lineWidth / lod;
        
        return true;
    }

    /**
     * Checks if a line defined by p1 and p2 intersects a grid aligned bounding box.
     * @param {object} p1 The start point of the line {x,y}.
     * @param {object} p2 The end point of the line {x,y}.
     * @param {object} min The bottom left corner of the bounding box {x,y}.
     * @param {object} max The top right corner of the bounding box {x,y}.
     * @return {object|false} If there is an intersection then the coordinates are returned, otherwise returns false.
     */
    #does_line_intersect_bounding_box(p1, p2, min, max)
    {
        // Test against bottom border.
        let intersection = this.#intersect(p1.x, p1.y, p2.x, p2.y, min.x, min.y, max.x, min.y);
        if (intersection !== false) return intersection;
        // Test against right border.
        intersection = this.#intersect(p1.x, p1.y, p2.x, p2.y, max.x, min.y, max.x, max.y);
        if (intersection !== false) return intersection;
        // Test against top border.
        intersection = this.#intersect(p1.x, p1.y, p2.x, p2.y, max.x, max.y, min.x, max.y);
        if (intersection !== false) return intersection;
        // Test against left border.
        intersection = this.#intersect(p1.x, p1.y, p2.x, p2.y, min.x, max.y, min.x, min.y);
        
        return intersection;
    }

    // line intercept math by Paul Bourke http://paulbourke.net/geometry/pointlineplane/
    // Determine the intersection point of two line segments
    // Return FALSE if the lines don't intersect
    #intersect(x1, y1, x2, y2, x3, y3, x4, y4)
    {
        // Check if none of the lines are of length 0
        if ((x1 === x2 && y1 === y2) || (x3 === x4 && y3 === y4)) {
            return false
        }

        let denominator = ((y4 - y3) * (x2 - x1) - (x4 - x3) * (y2 - y1))

        // Lines are parallel
        if (denominator === 0) {
            return false
        }

        let ua = ((x4 - x3) * (y1 - y3) - (y4 - y3) * (x1 - x3)) / denominator
        let ub = ((x2 - x1) * (y1 - y3) - (y2 - y1) * (x1 - x3)) / denominator

        // is the intersection along the segments
        if (ua < 0 || ua > 1 || ub < 0 || ub > 1) {
            return false
        }

        // Return a object with the x and y coordinates of the intersection
        let x = x1 + ua * (x2 - x1)
        let y = y1 + ua * (y2 - y1)

        return {x, y}
    }
}

export {FeatureManager}
