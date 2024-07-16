
/**
 * Class for working with a KML file.
 */
class KML
{
    /**
     * The KML document
     */
    doc = null;

    locations = {};

    name = null;
    locations_cnt = 0;

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
                this.name = $(doc).find('name').first().text();
                // Look for all folders that exist. For each folder look for Placemark tags that are top level children of that folder.
                let folders = $(doc).find('Folder');
                for (let folder of folders)
                {
                    let placemarks = $(folder).children('Placemark');
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
                    let folder_name = $(folder).find('name').first().text();
                    this.locations[folder_name] = locations;
                    this.locations_cnt += locations.length;
                }
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
