import urllib.request
import json
import xml.etree.ElementTree as ET
import os

def get_wikimedia_file_url(filename):
    api_url = f"https://commons.wikimedia.org/w/api.php?action=query&titles=File:{filename}&prop=imageinfo&iiprop=url&format=json"
    try:
        req = urllib.request.Request(api_url, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req) as response:
            data = json.loads(response.read().decode())
            pages = data['query']['pages']
            for page_id in pages:
                imageinfo = pages[page_id].get('imageinfo', [])
                if imageinfo:
                    return imageinfo[0]['url']
    except Exception as e:
        print(f"Error fetching URL from Wikipedia: {e}")
    return None

def download_and_extract(filename):
    url = get_wikimedia_file_url(filename)
    if not url:
        print(f"Could not find URL for {filename}")
        return
    print(f"Downloading {filename} from {url}...")
    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req) as response:
            svg_content = response.read().decode('utf-8')
            
        os.makedirs("scratch", exist_ok=True)
        raw_path = os.path.join("scratch", filename)
        with open(raw_path, 'w', encoding='utf-8') as f:
            f.write(svg_content)
        print(f"Saved raw SVG to {raw_path}")
        
        # Parse SVG and find paths
        root = ET.fromstring(svg_content)
        paths = []
        for elem in root.iter():
            tag = elem.tag.split('}')[-1] # strip namespace
            if tag == 'path':
                path_id = elem.attrib.get('id', '')
                d_attr = elem.attrib.get('d', '')
                fill = elem.attrib.get('fill', '')
                stroke = elem.attrib.get('stroke', '')
                paths.append({'id': path_id, 'd': d_attr, 'fill': fill, 'stroke': stroke})
        
        print(f"Found {len(paths)} paths in the SVG.")
        for p in paths[:10]:
            print(f"Path ID: {p['id']}, Fill: {p['fill']}, d start: {p['d'][:80]}...")
            
    except Exception as e:
        print(f"Error processing SVG: {e}")

if __name__ == "__main__":
    download_and_extract("IN-KA.svg")
    download_and_extract("Map_of_Karnataka.svg")
