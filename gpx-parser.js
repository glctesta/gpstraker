/**
 * GPX file parser
 *
 * @author Anton Podviaznikov
 * @copyright 2019-2022 Anton Podviaznikov
 * @license MIT
 */
/* eslint-disable no-undef */
class gpxParser {
  constructor() {
    this.xmlSource = '';
    this.metadata = {};
    this.waypoints = [];
    this.tracks = [];
    this.routes = [];
  }

  /**
   * Parse a gpx file from a string
   *
   * @param {string} gpxstring - The gpx file as a string
   *
   * @return {object} A gpx object.
   */
  parse(gpxstring) {
    const gpx = new DOMParser().parseFromString(gpxstring, 'text/xml');

    this.xmlSource = gpx;

    const metadata = gpx.querySelector('metadata');
    const waypoints = gpx.querySelectorAll('wpt');
    const tracks = gpx.querySelectorAll('trk');
    const routes = gpx.querySelectorAll('rte');

    if (metadata) {
      this.metadata = this.parseMetadata(metadata);
    }

    if (waypoints) {
      this.waypoints = this.parseWaypoints(waypoints);
    }

    if (tracks) {
      this.tracks = this.parseTracks(tracks);
    }

    if (routes) {
      this.routes = this.parseRoutes(routes);
    }

    return this;
  }

  /**
   * Parse a metadata
   *
   * @param {object} metadata - The metadata gpx object
   *
   * @return {object} A metadata object.
   */
  parseMetadata(metadata) {
    const name = metadata.querySelector('name');
    const desc = metadata.querySelector('desc');
    const author = metadata.querySelector('author');
    const copyright = metadata.querySelector('copyright');
    const link = metadata.querySelector('link');
    const time = metadata.querySelector('time');
    const keywords = metadata.querySelector('keywords');
    const bounds = metadata.querySelector('bounds');

    const result = {};

    if (name) {
      result.name = name.innerHTML;
    }

    if (desc) {
      result.desc = desc.innerHTML;
    }

    if (author) {
      result.author = this.parseAuthor(author);
    }

    if (copyright) {
      result.copyright = this.parseCopyright(copyright);
    }

    if (link) {
      result.link = this.parseLink(link);
    }

    if (time) {
      result.time = time.innerHTML;
    }

    if (keywords) {
      result.keywords = keywords.innerHTML;
    }

    if (bounds) {
      result.bounds = this.parseBounds(bounds);
    }

    return result;
  }

  /**
   * Parse a author
   *
   * @param {object} author - The author gpx object
   *
   * @return {object} A author object.
   */
  parseAuthor(author) {
    const name = author.querySelector('name');
    const email = author.querySelector('email');
    const link = author.querySelector('link');

    const result = {};

    if (name) {
      result.name = name.innerHTML;
    }

    if (email) {
      result.email = this.parseEmail(email);
    }

    if (link) {
      result.link = this.parseLink(link);
    }

    return result;
  }

  /**
   * Parse a copyright
   *
   * @param {object} copyright - The copyright gpx object
   *
   * @return {object} A copyright object.
   */
  parseCopyright(copyright) {
    const year = copyright.querySelector('year');
    const license = copyright.querySelector('license');
    const author = copyright.getAttribute('author');

    const result = {};

    if (year) {
      result.year = year.innerHTML;
    }

    if (license) {
      result.license = license.innerHTML;
    }

    if (author) {
      result.author = author;
    }

    return result;
  }

  /**
   * Parse a link
   *
   * @param {object} link - The link gpx object
   *
   * @return {object} A link object.
   */
  parseLink(link) {
    const href = link.getAttribute('href');
    const text = link.querySelector('text');
    const type = link.querySelector('type');

    const result = {};

    if (href) {
      result.href = href;
    }

    if (text) {
      result.text = text.innerHTML;
    }

    if (type) {
      result.type = type.innerHTML;
    }

    return result;
  }

  /**
   * Parse a email
   *
   * @param {object} email - The email gpx object
   *
   * @return {object} A email object.
   */
  parseEmail(email) {
    const id = email.getAttribute('id');
    const domain = email.getAttribute('domain');

    const result = {};

    if (id) {
      result.id = id;
    }

    if (domain) {
      result.domain = domain;
    }

    return result;
  }

  /**
   * Parse a bounds
   *
   * @param {object} bounds - The bounds gpx object
   *
   * @return {object} A bounds object.
   */
  parseBounds(bounds) {
    return {
      minlat: parseFloat(bounds.getAttribute('minlat')),
      minlon: parseFloat(bounds.getAttribute('minlon')),
      maxlat: parseFloat(bounds.getAttribute('maxlat')),
      maxlon: parseFloat(bounds.getAttribute('maxlon')),
    };
  }

  /**
   * Parse a waypoints
   *
   * @param {object} waypoints - The waypoints gpx object
   *
   * @return {object} A waypoints object.
   */
  parseWaypoints(waypoints) {
    const result = [];

    waypoints.forEach((waypoint) => {
      const point = this.parsePoint(waypoint);
      result.push(point);
    });

    return result;
  }

  /**
   * Parse a routes
   *
   * @param {object} routes - The routes gpx object
   *
   * @return {object} A routes object.
   */
  parseRoutes(routes) {
    const result = [];

    routes.forEach((route) => {
      const name = route.querySelector('name');
      const cmt = route.querySelector('cmt');
      const desc = route.querySelector('desc');
      const src = route.querySelector('src');
      const number = route.querySelector('number');
      const type = route.querySelector('type');
      const link = route.querySelector('link');
      const rtepts = route.querySelectorAll('rtept');

      const routeObject = {};

      if (name) {
        routeObject.name = name.innerHTML;
      }

      if (cmt) {
        routeObject.cmt = cmt.innerHTML;
      }

      if (desc) {
        routeObject.desc = desc.innerHTML;
      }

      if (src) {
        routeObject.src = src.innerHTML;
      }

      if (number) {
        routeObject.number = number.innerHTML;
      }

      if (type) {
        routeObject.type = type.innerHTML;
      }

      if (link) {
        routeObject.link = this.parseLink(link);
      }

      if (rtepts) {
        const points = [];
        rtepts.forEach((rtept) => {
          const point = this.parsePoint(rtept);
          points.push(point);
        });
        routeObject.points = points;
      }

      result.push(routeObject);
    });

    return result;
  }

  /**
   * Parse a tracks
   *
   * @param {object} tracks - The tracks gpx object
   *
   * @return {object} A tracks object.
   */
  parseTracks(tracks) {
    const result = [];

    tracks.forEach((track) => {
      const name = track.querySelector('name');
      const cmt = track.querySelector('cmt');
      const desc = track.querySelector('desc');
      const src = track.querySelector('src');
      const number = track.querySelector('number');
      const type = track.querySelector('type');
      const link = track.querySelector('link');
      const trksegs = track.querySelectorAll('trkseg');

      const trackObject = {};

      if (name) {
        trackObject.name = name.innerHTML;
      }

      if (cmt) {
        trackObject.cmt = cmt.innerHTML;
      }

      if (desc) {
        trackObject.desc = desc.innerHTML;
      }

      if (src) {
        trackObject.src = src.innerHTML;
      }

      if (number) {
        trackObject.number = number.innerHTML;
      }

      if (type) {
        trackObject.type = type.innerHTML;
      }

      if (link) {
        trackObject.link = this.parseLink(link);
      }

      if (trksegs) {
        const segments = [];
        trksegs.forEach((trkseg) => {
          const trkpts = trkseg.querySelectorAll('trkpt');
          const segment = [];
          trkpts.forEach((trkpt) => {
            const point = this.parsePoint(trkpt);
            segment.push(point);
          });
          segments.push(segment);
        });
        trackObject.segments = segments;
      }

      result.push(trackObject);
    });

    return result;
  }

  /**
   * Parse a point
   *
   * @param {object} point - The point gpx object
   *
   * @return {object} A point object.
   */
  parsePoint(point) {
    const ele = point.querySelector('ele');
    const time = point.querySelector('time');
    const magvar = point.querySelector('magvar');
    const geoidheight = point.querySelector('geoidheight');
    const name = point.querySelector('name');
    const cmt = point.querySelector('cmt');
    const desc = point.querySelector('desc');
    const src = point.querySelector('src');
    const sym = point.querySelector('sym');
    const type = point.querySelector('type');
    const fix = point.querySelector('fix');
    const sat = point.querySelector('sat');
    const hdop = point.querySelector('hdop');
    const vdop = point.querySelector('vdop');
    const pdop = point.querySelector('pdop');
    const ageofdgpsdata = point.querySelector('ageofdgpsdata');
    const dgpsid = point.querySelector('dgpsid');
    const link = point.querySelector('link');

    const pointObject = {
      lat: parseFloat(point.getAttribute('lat')),
      lon: parseFloat(point.getAttribute('lon')),
    };

    if (ele) {
      pointObject.ele = parseFloat(ele.innerHTML);
    }

    if (time) {
      pointObject.time = time.innerHTML;
    }

    if (magvar) {
      pointObject.magvar = magvar.innerHTML;
    }

    if (geoidheight) {
      pointObject.geoidheight = geoidheight.innerHTML;
    }

    if (name) {
      pointObject.name = name.innerHTML;
    }

    if (cmt) {
      pointObject.cmt = cmt.innerHTML;
    }

    if (desc) {
      pointObject.desc = desc.innerHTML;
    }

    if (src) {
      pointObject.src = src.innerHTML;
    }

    if (sym) {
      pointObject.sym = sym.innerHTML;
    }

    if (type) {
      pointObject.type = type.innerHTML;
    }

    if (fix) {
      pointObject.fix = fix.innerHTML;
    }

    if (sat) {
      pointObject.sat = sat.innerHTML;
    }

    if (hdop) {
      pointObject.hdop = hdop.innerHTML;
    }

    if (vdop) {
      pointObject.vdop = vdop.innerHTML;
    }

    if (pdop) {
      pointObject.pdop = pdop.innerHTML;
    }

    if (ageofdgpsdata) {
      pointObject.ageofdgpsdata = ageofdgpsdata.innerHTML;
    }

    if (dgpsid) {
      pointObject.dgpsid = dgpsid.innerHTML;
    }

    if (link) {
      pointObject.link = this.parseLink(link);
    }

    return pointObject;
  }

  /**
   * Calculate a total distance for a tracks
   *
   * @param {object} options - The options object
   *
   * @return {number} A total distance in meters.
   */
  calculDistance(points) {
    let distance = 0;
    let lastPoint = null;

    points.forEach((point) => {
      if (lastPoint) {
        distance += this.getDistanceBetweenTwoPoints(lastPoint, point);
      }
      lastPoint = point;
    });

    return distance;
  }

  /**
   * Calculate a distance between two points
   *
   * @param {object} point1 - The point gpx object
   * @param {object} point2 - The point gpx object
   *
   * @return {number} A distance in meters.
   */
  getDistanceBetweenTwoPoints(point1, point2) {
    const R = 6371e3; // metres
    const lat1 = (point1.lat * Math.PI) / 180;
    const lat2 = (point2.lat * Math.PI) / 180;
    const deltaLat = ((point2.lat - point1.lat) * Math.PI) / 180;
    const deltaLon = ((point2.lon - point1.lon) * Math.PI) / 180;

    const a =
      Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
      Math.cos(lat1) *
        Math.cos(lat2) *
        Math.sin(deltaLon / 2) *
        Math.sin(deltaLon / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  }
}

if (typeof module !== 'undefined') {
  module.exports = gpxParser;
}