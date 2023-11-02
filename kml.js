
/**
 * Class for working with a KML file.
 */
class KML
{
    /**
     * The KML document
     */
    doc = null;

    locations = [];

    /**
     * Loads a KML file.
     * @param {string} file 
     */
    async load(file)
    {
        return new Promise((resolve, reject) => {
            const req = new XMLHttpRequest();
            req.onload = (e) => {
                let doc = this.doc = req.response;
                let placemarks = $(doc).find('Placemark');
                let locations = [];
                for (let placemark of placemarks)
                {
                    let name = $(placemark).find('name').text();
                    let coords = $(placemark).find('coordinates').text();
                    // Placemarks can represent tracks which don't have a coordinates node. Skip them.
                    if (coords == '') continue;
                    coords = coords.split(',');
                    locations.push({
                        name: name,
                        lon: coords[0],
                        lat: coords[1],
                        height: coords[2] ?? null
                    })
                    //console.log(name, coords);
                }
                this.locations = locations;
                resolve(this);
                return;
            };
            req.open("GET", file);
            req.responseType = "document";
            req.addEventListener("error", (xhr, event) => reject('Error loading file'));
            req.send();
        }); 
    }

}

export {KML};
