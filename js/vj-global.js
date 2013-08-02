// make console.log safe to use
window.console||(console={log:function (){}});

var Casa = Casa || {};

//site settings
Casa.Settings = {
    debug: true // is debugging turned on?
};

//site data
Casa.Data = {
    width: 0, // page width
    height: 0, // page height
    pixelRatio: 0, //screen pixel ratio
    overlayScrollTop: 0 // Scroll top of body element for overlays
};

//Dom Elements
Casa.Elements = {
    $html: $('html'),
    $body: $('body')
};

//site core
Casa.Core = (function () {

    "use strict";

    var init = function () {

        if (Modernizr.csstransitions) {
            Casa.Data.transitions = true;
        }
        if (Modernizr.touch) {
            Casa.Data.touch = true;
        }

        map.init();

    },

    utils = {
        isFunction: function (functionToCheck) {
            var getType = {};
            return functionToCheck && getType.toString.call(functionToCheck) === '[object Function]';
        },
        countProperties: function (obj) {
            var count = 0, prop;
            for (prop in obj) {
                if (obj.hasOwnProperty(prop)) {
                    ++count;
                }
            }
            return count;
        },
        scrollToPosition: function (position, duration) {
            $('html, body').animate({
                scrollTop: position
            }, duration);
        }
    },

    googleMaps = {
        mapsLoaded: false,
        injectGoogleScript: function () {
            var script = document.createElement("script");
            script.type = "text/javascript";
            script.src = "http://maps.googleapis.com/maps/api/js?key=AIzaSyD-AkcauXA422KH0ZvfkG_I4Oo6LH7Ouqg&sensor=true&libraries=places&callback=googleMapsLoaded";
            document.body.appendChild(script);
            googleMaps.mapsLoaded = true;
        },

        // remove markers, needed when updating the search params
        clearMarkers: function (markers, infoBubbles) {
            var key;
            for (key in markers) {
                if (markers.hasOwnProperty(key)) {
                    markers[key].setMap(null);
                }
            }
            for (key in infoBubbles) {
                if (infoBubbles.hasOwnProperty(key)) {
                    infoBubbles[key].close();
                }
            }
        },

        createMarker: function (latlng, map, html) {
            var contentString = html,
            marker = new google.maps.Marker({
                position: latlng,
                map: map
            });
        },

        drawArc: function (center, initialBearing, finalBearing, radius) {
            var d2r = Math.PI / 180,   // degrees to radians
                r2d = 180 / Math.PI,   // radians to degrees
                points = 400,
                // find the raidus in lat/lon
                rlat = (radius / 6378137.0) * r2d,
                rlng = rlat / Math.cos(center.lat() * d2r),
                extp = [],
                deltaBearing, i;

            if (initialBearing > finalBearing) {
                finalBearing += 360;
            }

            deltaBearing = finalBearing - initialBearing;

            deltaBearing = deltaBearing / points;
            for (i = 0; (i < points + 1); i++)
            {
                extp.push(center.DestinationPoint(initialBearing + i * deltaBearing, radius));
            }
            return extp;
        },

        extendGoogleMaps: function () {
            // === first support methods that don't (yet) exist in v3
            google.maps.LatLng.prototype.distanceFrom = function (newLatLng) {
                var EarthRadiusMeters = 6378137.0,
                    lat1 = this.lat(),
                    lon1 = this.lng(),
                    lat2 = newLatLng.lat(),
                    lon2 = newLatLng.lng(),
                    dLat = (lat2 - lat1) * Math.PI / 180,
                    dLon = (lon2 - lon1) * Math.PI / 180,
                    a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
                    Math.sin(dLon / 2) * Math.sin(dLon / 2),
                    c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)),
                    d = EarthRadiusMeters * c;
                return d;
            };

            google.maps.LatLng.prototype.latRadians = function () {
                return this.lat() * Math.PI / 180;
            };

            google.maps.LatLng.prototype.lngRadians = function () {
                return this.lng() * Math.PI / 180;
            };

            // === A method for testing if a point is inside a polygon
            // === Returns true if poly contains point
            // === Algorithm shamelessly stolen from http://alienryderflex.com/polygon/
            google.maps.Polygon.prototype.Contains = function (point) {
                var i, j = 0,
                    oddNodes = false,
                    x = point.lng(),
                    y = point.lat();
                for (i = 0; i < this.getPath().getLength(); i++) {
                    j++;
                    if (j === this.getPath().getLength()) {j = 0; }
                    if (((this.getPath().getAt(i).lat() < y) && (this.getPath().getAt(j).lat() >= y)) || ((this.getPath().getAt(j).lat() < y) && (this.getPath().getAt(i).lat() >= y))) {
                        if (this.getPath().getAt(i).lng() + (y - this.getPath().getAt(i).lat()) / (this.getPath().getAt(j).lat() - this.getPath().getAt(i).lat()) * (this.getPath().getAt(j).lng() - this.getPath().getAt(i).lng()) < x) {
                            oddNodes = !oddNodes;
                        }
                    }
                }
                return oddNodes;
            };

            // === A method which returns the approximate area of a non-intersecting polygon in square metres ===
            // === It doesn't fully account for spherical geometry, so will be inaccurate for large polygons ===
            // === The polygon must not intersect itself ===
            google.maps.Polygon.prototype.Area = function () {
                var i, x1, x2, y1, y2, a = 0,
                    j = 0,
                    b = this.Bounds(),
                    x0 = b.getSouthWest().lng(),
                    y0 = b.getSouthWest().lat();
                for (i = 0; i < this.getPath().getLength(); i++) {
                    j++;
                    if (j === this.getPath().getLength()) {
                        j = 0;
                    }
                    x1 = this.getPath().getAt(i).distanceFrom(new google.maps.LatLng(this.getPath().getAt(i).lat(), x0));
                    x2 = this.getPath().getAt(j).distanceFrom(new google.maps.LatLng(this.getPath().getAt(j).lat(), x0));
                    y1 = this.getPath().getAt(i).distanceFrom(new google.maps.LatLng(y0, this.getPath().getAt(i).lng()));
                    y2 = this.getPath().getAt(j).distanceFrom(new google.maps.LatLng(y0, this.getPath().getAt(j).lng()));
                    a += x1 * y2 - x2 * y1;
                }
                return Math.abs(a * 0.5);
            };

            // === A method which returns the length of a path in metres ===
            google.maps.Polygon.prototype.Distance = function () {
                var dist = 0, i;
                for (i = 1; i < this.getPath().getLength(); i++) {
                    dist += this.getPath().getAt(i).distanceFrom(this.getPath().getAt(i - 1));
                }
                return dist;
            };

            // === A method which returns the bounds as a GLatLngBounds ===
            google.maps.Polygon.prototype.Bounds = function () {
                var i, bounds = new google.maps.LatLngBounds();
                for (i = 0; i < this.getPath().getLength(); i++) {
                    bounds.extend(this.getPath().getAt(i));
                }
                return bounds;
            };

            // === A method which returns a GLatLng of a point a given distance along the path ===
            // === Returns null if the path is shorter than the specified distance ===
            google.maps.Polygon.prototype.GetPointAtDistance = function (metres) {
                var i, dist = 0,
                    olddist = 0;
                // some awkward special cases
                if (metres === 0) {
                    return this.getPath().getAt(0);
                }
                if (metres < 0 || this.getPath().getLength() < 2) {
                    return null;
                }
                for (var i=1; (i < this.getPath().getLength() && dist < metres); i++) {
                olddist = dist;
                dist += this.getPath().getAt(i).distanceFrom(this.getPath().getAt(i-1));
              }
              if (dist < metres) {
                return null;
              }
              var p1= this.getPath().getAt(i-2);
              var p2= this.getPath().getAt(i-1);
              var m = (metres-olddist)/(dist-olddist);
              return new google.maps.LatLng( p1.lat() + (p2.lat()-p1.lat())*m, p1.lng() + (p2.lng()-p1.lng())*m);
            };

            // === A method which returns an array of GLatLngs of points a given interval along the path ===
            google.maps.Polygon.prototype.GetPointsAtDistance = function(metres) {
              var next = metres;
              var points = [];
              // some awkward special cases
              if (metres <= 0) return points;
              var dist=0;
              var olddist=0;
              for (var i=1; (i < this.getPath().getLength()); i++) {
                olddist = dist;
                dist += this.getPath().getAt(i).distanceFrom(this.getPath().getAt(i-1));
                while (dist > next) {
                  var p1= this.getPath().getAt(i-1);
                  var p2= this.getPath().getAt(i);
                  var m = (next-olddist)/(dist-olddist);
                  points.push(new google.maps.LatLng( p1.lat() + (p2.lat()-p1.lat())*m, p1.lng() + (p2.lng()-p1.lng())*m));
                  next += metres;
                }
              }
              return points;
            };

            // === A method which returns the Vertex number at a given distance along the path ===
            // === Returns null if the path is shorter than the specified distance ===
            google.maps.Polygon.prototype.GetIndexAtDistance = function(metres) {
              // some awkward special cases
              if (metres == 0) return this.getPath().getAt(0);
              if (metres < 0) return null;
              var dist=0;
              var olddist=0;
              for (var i=1; (i < this.getPath().getLength() && dist < metres); i++) {
                olddist = dist;
                dist += this.getPath().getAt(i).distanceFrom(this.getPath().getAt(i-1));
              }
              if (dist < metres) {return null;}
              return i;
            };

            // === A function which returns the bearing between two vertices in decgrees from 0 to 360===
            // === If v1 is null, it returns the bearing between the first and last vertex ===
            // === If v1 is present but v2 is null, returns the bearing from v1 to the next vertex ===
            // === If either vertex is out of range, returns void ===
            google.maps.Polygon.prototype.Bearing = function(v1,v2) {
              if (v1 == null) {
                v1 = 0;
                v2 = this.getPath().getLength()-1;
              } else if (v2 ==  null) {
                v2 = v1+1;
              }
              if ((v1 < 0) || (v1 >= this.getPath().getLength()) || (v2 < 0) || (v2 >= this.getPath().getLength())) {
                return;
              }
              var from = this.getPath().getAt(v1);
              var to = this.getPath().getAt(v2);
              if (from.equals(to)) {
                return 0;
              }
              var lat1 = from.latRadians();
              var lon1 = from.lngRadians();
              var lat2 = to.latRadians();
              var lon2 = to.lngRadians();
              var angle = - Math.atan2( Math.sin( lon1 - lon2 ) * Math.cos( lat2 ), Math.cos( lat1 ) * Math.sin( lat2 ) - Math.sin( lat1 ) * Math.cos( lat2 ) * Math.cos( lon1 - lon2 ) );
              if ( angle < 0.0 ) angle  += Math.PI * 2.0;
              angle = angle * 180.0 / Math.PI;
              return parseFloat(angle.toFixed(1));
            };

            google.maps.LatLng.prototype.DestinationPoint = function (brng, dist) {
                var R = 6378137; // earth's mean radius in meters
                var brng = brng.toRad();
                var lat1 = this.lat().toRad(), lon1 = this.lng().toRad();
                var lat2 = Math.asin( Math.sin(lat1)*Math.cos(dist/R) +
                                  Math.cos(lat1)*Math.sin(dist/R)*Math.cos(brng) );
                var lon2 = lon1 + Math.atan2(Math.sin(brng)*Math.sin(dist/R)*Math.cos(lat1),
                                         Math.cos(dist/R)-Math.sin(lat1)*Math.sin(lat2));

                return new google.maps.LatLng(lat2.toDeg(), lon2.toDeg());
            };


            // === Copy all the above functions to GPolyline ===
            google.maps.Polyline.prototype.Contains             = google.maps.Polygon.prototype.Contains;
            google.maps.Polyline.prototype.Area                 = google.maps.Polygon.prototype.Area;
            google.maps.Polyline.prototype.Distance             = google.maps.Polygon.prototype.Distance;
            google.maps.Polyline.prototype.Bounds               = google.maps.Polygon.prototype.Bounds;
            google.maps.Polyline.prototype.GetPointAtDistance   = google.maps.Polygon.prototype.GetPointAtDistance;
            google.maps.Polyline.prototype.GetPointsAtDistance  = google.maps.Polygon.prototype.GetPointsAtDistance;
            google.maps.Polyline.prototype.GetIndexAtDistance   = google.maps.Polygon.prototype.GetIndexAtDistance;
            google.maps.Polyline.prototype.Bearing              = google.maps.Polygon.prototype.Bearing;





            google.maps.LatLng.prototype.Bearing = function (otherLatLng) {
                var from = this,
                    to = otherLatLng, lat1, lon1, lat2, lon2, angle;
                if (from.equals(to)) {
                    return 0;
                }
                lat1 = from.latRadians();
                lon1 = from.lngRadians();
                lat2 = to.latRadians();
                lon2 = to.lngRadians();
                angle = - Math.atan2(Math.sin(lon1 - lon2) * Math.cos(lat2), Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(lon1 - lon2));
                if (angle < 0.0) {
                    angle  += Math.PI * 2.0;
                }
                if (angle > Math.PI) {
                    angle -= Math.PI * 2.0;
                }
                return parseFloat(angle.toDeg());
            };


            /**
             * Extend the Number object to convert degrees to radians
             *
             * @return {Number} Bearing in radians
             * @ignore
             */
            Number.prototype.toRad = function () {
                return this * Math.PI / 180;
            };

            /**
             * Extend the Number object to convert radians to degrees
             *
             * @return {Number} Bearing in degrees
             * @ignore
             */
            Number.prototype.toDeg = function () {
                return this * 180 / Math.PI;
            };

            /**
             * Normalize a heading in degrees to between 0 and +360
             *
             * @return {Number} Return
             * @ignore
             */
            Number.prototype.toBrng = function () {
                return (this.toDeg() + 360) % 360;
            };
        }
    },


    map = {
        elems: {},
        paths: {},
        init: function () {
            if (!googleMaps.mapsLoaded) {
                $(window).bind('googleMapsLoaded', map.initGoogleMaps);
                googleMaps.injectGoogleScript();
            }

            Casa.Elements.$body.on('click', '.image', function () {
                map.plotImage();
            });

            Casa.Elements.$body.on('click', '.curve', function () {
                map.drawStuff();
            });

            Casa.Elements.$body.on('click', '.kml', function (e) {
                map.plotKml($(this).attr('href'));
                e.preventDefault();
            });

            Casa.Elements.$body.on('click', '.clear', function () {
                map.clearAll();
            });
        },

        initGoogleMaps: function () {
            var mapOptions = {
                zoom: 9,
                mapTypeId: "OSM",
                center: new google.maps.LatLng(-37.666667, 144.83333333)
               // center: new google.maps.LatLng(-37.7, 144.9)
            },
            mapTypeIds = [], type;
            for(type in google.maps.MapTypeId) {
                if (google.maps.MapTypeId.hasOwnProperty(type)) {
                    mapTypeIds.push(google.maps.MapTypeId[type]);
                }
            }

            mapTypeIds.push("OSM");

            map.elems.canvas = new google.maps.Map(document.getElementById("map_canvas"), mapOptions);

            map.elems.canvas.mapTypes.set("OSM", new google.maps.ImageMapType({
                getTileUrl: function(coord, zoom) {
                    console.log("http://tile.openstreetmap.org/" + zoom + "/" + coord.x + "/" + coord.y + ".png");
                    return "http://tile.openstreetmap.org/" + zoom + "/" + coord.x + "/" + coord.y + ".png";
                },
                tileSize: new google.maps.Size(256, 256),
                name: "OpenStreetMap",
                maxZoom: 18
            }));


            googleMaps.extendGoogleMaps();
            console.log('start map');
        },

        clearAll: function () {
            console.log('Clearing all');
            if (map.elems.imageOverlay) {
                map.elems.imageOverlay.setMap(null);
            }
            if (map.elems.kmlOverlay) {
                map.elems.kmlOverlay.setMap(null);
            }
        },

        plotImage: function () {
            var LatLong1 = new google.maps.LatLng(-38.50, 144.166667),
            LatLong2 = new google.maps.LatLng(-37.1, 145.50),
            bounds = new google.maps.LatLngBounds(LatLong1, LatLong2);
            console.log('plot Image');

            map.elems.imageOverlay = new google.maps.GroundOverlay(
                '/img/overlay2.png',
                bounds
            );
            map.elems.imageOverlay.setMap(map.elems.canvas);
        },

        plotKml: function (url) {
            console.log('plot KML - ', url);
            map.elems.kmlOverlay = new google.maps.KmlLayer({url: url});
            map.elems.kmlOverlay.setMap(map.elems.canvas);
        },

        drawStuff: function () {
            var startPoint = new google.maps.LatLng(-37.741667, 144.55),
                endPoint = new google.maps.LatLng(-37.85, 145.05),
                centerPoint = new google.maps.LatLng(-37.666667, 144.83333333),
                path;

            this.drawArcs();


            new google.maps.Circle({
              strokeColor: '#FF0000',
              strokeOpacity: 0.8,
              strokeWeight: 2,
              fillOpacity: 0,
              map: map.elems.canvas,
              center: centerPoint,
              radius: 30000,
              draggable: true,
              editable: true,
              icons: [{
                icon: {
                    path: 'M 0, 0 -2, 0, M 0, 0 2, 0',
                    strokeOpacity: 1,
                    scale: 2,
                    strokeColor: "#f08ee1"
                },
                offset: '0',
                repeat: '3px'
            }]
            });


            centerPoint = new google.maps.LatLng(-38.025, 144.5);

            startPoint = new google.maps.LatLng(-37.916667, 144.4);
            endPoint = new google.maps.LatLng(-37.95, 144.633333);

            path = this.getCurve(startPoint, endPoint, centerPoint);

            startPoint = new google.maps.LatLng(-38.116667, 144.633333);
            endPoint = new google.maps.LatLng(-38.15, 144.366667);

            this.plotPolygon(path.concat(this.getCurve(startPoint, endPoint, centerPoint)), [{
                icon: {
                    path: 'M 0, 0 -2, 0, M 0, 0 2, 0',
                    strokeOpacity: 1,
                    scale: 2,
                    strokeColor: "#f08ee1"
                },
                offset: '0',
                repeat: '3px'
            }]);

        },

        drawArcs: function () {
             var key, startPoint, endPoint, centerPoint, path;

            $.get('data/lines.json', function (data) {
                (data.content);

                for (key in data.arcs) {
                    // don't want to replace price at the moment as it never changes. Will change at some point when API Updated
                    if (data.arcs.hasOwnProperty(key)) {
                        console.log(data.arcs[key].lineColor);
                        startPoint = new google.maps.LatLng(data.arcs[key].start.lat, data.arcs[key].start.lng),
                        endPoint = new google.maps.LatLng(data.arcs[key].end.lat, data.arcs[key].end.lng),
                        centerPoint = new google.maps.LatLng(data.arcs[key].center.lat, data.arcs[key].center.lng),

                        map.plotLine(map.getCurve(startPoint, endPoint, centerPoint), data.arcs[key].line.opacity, data.arcs[key].line.color, data.arcs[key].line.weight, [data.arcs[key].icon]);
                    }
                }

            }, 'json').fail(function (e) {
            }).always(function () {
            });
        },

        getCurve: function (startPoint, endPoint, centerPoint) {

            console.log('getting Curve');

            // googleMaps.createMarker(startPoint, map.elems.canvas, "start");
            // googleMaps.createMarker(endPoint, map.elems.canvas, "end");
            // googleMaps.createMarker(centerPoint, map.elems.canvas, "center: ");

            return googleMaps.drawArc(centerPoint, centerPoint.Bearing(startPoint), centerPoint.Bearing(endPoint), centerPoint.distanceFrom(startPoint));
        },

        plotLine: function (path, opacity, color, weight, icons ) {
            var poly;
            console.log('ploting path - ', path);
            poly = new google.maps.Polyline({
                path: [path],
                strokeOpacity: opacity,
                strokeColor: color,
                strokeWeight: weight,
                icons: icons,
                map:  map.elems.canvas
            });
        },

        plotPolygon: function (path, icons) {
            var poly;
            console.log('ploting path - ', path);
            poly = new google.maps.Polygon({
                paths: [path],
                strokeColor: '#FF0000',
                strokeOpacity: 0.8,
                strokeWeight: 4,
                icons: icons,
                fillOpacity: 0,
                map:  map.elems.canvas
            });
        }
    };

    return {
        run: init
    };
}());

function googleMapsLoaded() {
    console.log('google maps loaded');
    $(window).trigger('googleMapsLoaded');
}
