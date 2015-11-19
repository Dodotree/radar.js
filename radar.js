/* globals Raphael */
Raphael.fn.radarchart = function (data, grid, size, style, selectCallback) {
    'use strict';

    function linedOn(origin, base, bias) {
        return origin + (base - origin) * bias;
    }//get position along radar line

    function polygon(points, cx, cy, scale) { // polygon grid
        var path = '';
            for (var i = 0; i < points.length; i++) {
                var ind = i%points.length;
                var x = linedOn(cx, points[ind][0], scale);
                var y = linedOn(cy, points[ind][1], scale);
                path += ((i === 0) ? 'M' : 'L') + x + ' ' + y;
            }
            path +=' z';
        return path;
    }

    function pathString(cx, cy, points, score) {
        var x, y, vertex = [];
            for (var i = 0, len = points.length; i < len; i += 1) {
                x = linedOn(cx, points[i][0], score[i]);
                y = linedOn(cy, points[i][1], score[i]);
                vertex.push(x + ' ' + y);
        }
        return 'M' + vertex.join('L') + 'L' + vertex[0];
    }//get svg path string for a series

    var mouseUp = function () { this.animate(style.scores, 150); };
    var mouseOut = function () { this.animate({r: 3.5}, 150); };
    var mouseOver = function () { this.animate({r: 5}, 150); };
    var mouseDown = function () {
        score[this.axis] = this.score;
        ipoly.animate({path: pathString(cx, cy, points, score)}, 200);
    };//animates and registers score changes for single-series models
    var mouseOutHighlight = function () { 
        var index = this.axis;
        if( index == data.selectedAxis ){ return; }
        if( !data.scoresColored ){
            chartPoints[index].animate({fill:'#fff'}, 150);
        }
        labelHighlights[index].pulsing = false;
        labelHighlights[index].animate({'fill-opacity': 0}, 150); 
    };
    var mouseOverHighlight = function () { 
        var index = this.axis;
        if( index == data.selectedAxis ){ return; }
        chartPoints[index].animate({fill:data.colors[index]}, 150);
        labelHighlights[index].pulsing = true;
        pulse(index);
    };
    var selectAxis = function () {
        if( this.axis == data.selectedAxis ){ return; }
        directSelect( this.axis );
    }
    var directSelect = this.directSelect = function( index ){
        if( !data.scoresColored ){
            chartPoints[data.selectedAxis].animate({fill:'#fff'}, 150);
        }
        labelHighlights[data.selectedAxis].animate({'fill-opacity': 0}, 150); 
        data.selectedAxis = index;
        chartPoints[data.selectedAxis].animate({fill:data.colors[data.selectedAxis]}, 150);
        if(!labelHighlights[data.selectedAxis].pulsing){ // since mobile randomly starts mouseovers
            labelHighlights[data.selectedAxis].animate({'fill-opacity': 0.5}, 300); 
        } 
        labelHighlights[data.selectedAxis].pulsing = false;
        selectCallback( data.selectedAxis );
    }

    this.destruct = function() {
        for(var i = 0, len = st.length; i < len; i += 1) {
            if(st[i][0].localName === 'circle' && st[i].events !== undefined) {
                st[i].unmouseout(mouseOut);
                st[i].unmouseup(mouseUp);
                st[i].unmousedown(mouseDown);
                st[i].unmouseover(mouseOver);
            }//unbind all previously attached events
        }
    };

    var st = this.set();

    var w = size.width;
    var h = size.height;
    var angle = Math.PI*Number(size.startingAngle);

    var cx = w / 2;
    var cy = h / 2;
    var axis = null;
    var radius =1.05* (w < h ? w : h) / Math.PI;
    var sR = (1+2*size.labelDistancePercent)*radius; // sector radius
    var sides = data.scores[0].length;

    var ipoly, labelHighlights=[], chartPoints=[];
    labelHighlights.length = 0;
    chartPoints.length = 0;

    if( typeof data.max == "undefined" ){
        data.max = Math.max.apply(null, data.scores[0]);
        for( var i=0; i<data.scores; i++ ){
            data.max = Math.max( data.max, Math.max.apply(null, data.scores[0]) );
        }    
    }
    if( typeof data.min == "undefined" ){
        data.min = 0;
    }
    
    var separation_angle = 2*Math.PI / sides;
    var x,y, points = [[ cx + radius * Math.sin(angle), cy+radius * Math.cos(angle)]];
    var sectorPoints = [[ cx + sR * Math.sin(angle-separation_angle/2), 
                          cy+ sR * Math.cos(angle-separation_angle/2)]];
    for (var side = 1; side < sides; side += 1) {
        // "-" for clockwise
        angle -= separation_angle;
        x = cx + radius * Math.sin(angle);
        y = cy + radius * Math.cos(angle);
        points.push([x, y]);
        sectorPoints.push([ 
            cx + sR * Math.sin(angle-separation_angle/2), cy + sR * Math.cos(angle-separation_angle/2)]);
    }

    // draw the grid, 
    if( grid.type == 'polygon' ){
        for (var i = 0; i < grid.steps; i += 1) {
            st.push(this.path(polygon(points, cx, cy, 1-grid.increment*i)).attr(style.grid));
        }
    }else if( grid.type == 'circle' ){
        for (var i = 0; i < grid.steps; i += 1) {
            st.push(this.circle(cx,cy, (1-grid.increment*i)*radius).attr(style.grid));
        }
    }
    for (var i = 0; i < points.length; i += 1) {
        x = points[i][0];
        y = points[i][1];
        axis = this.path('M' + cx + ' ' + cy + 'L' + x + ' ' + y);
        st.push(axis.attr.apply(axis, style.axis));
    }//draw inner axes

    for (i = 0; i < points.length; i += 1) {
        x = linedOn(cx, points[i][0], 1 + size.labelDistancePercent);
        y = linedOn(cy, points[i][1], 1 + size.labelDistancePercent);
        style.label.fill = data.colors[i];
        labelHighlights.push( this.circle(x, y, size.highligtRpercent*radius)
            .attr({fill: data.colors[i], 'fill-opacity':0, stroke: 'none' }) );
        st.push(labelHighlights[i]);
        this.text(x, y, data.labels[i]).attr(style.label);
    }//draw labels

    for (var k = 0; k < data.scores.length; k += 1) {
        var score = []; score.length=0;
         score = score.concat( data.scores[k]);
        var scstyle = style.polygon[k];

        // scale scores
        for (i = 0; i < sides; i += 1) { score[i] = (score[i]-data.min) / (data.max-data.min); }

        // draws chart
        var ipoly = this.path(pathString(cx, cy, points, score)).attr(scstyle);
        st.push(ipoly);

        if(data.scores.length > 1) {
            //draw legend if more then 1 series
            var x1 = cx - 30;
            var bottom = points[points.length - 1][1];
            var y1 = bottom + 50 + 20 * k;
            var x2 = cy + 10;
            var y2 = y1;
            st.push(this.path('M' + x1 + ' ' + y1 + 'L' + x2 + ' ' + y2).attr(scstyle));
            this.text(x2 + 20, y2, data.legend[k]).attr(style.label);
        }

        if (data.scores.length > 1 || data.readonly === true) {
            for (i = 0; i < points.length; i += 1) {
                x = linedOn(cx, points[i][0], score[i]);
                y = linedOn(cy, points[i][1], score[i]);
                if( data.scoresColored ){
                  style.scores.fill = data.colors[i];
                }
                chartPoints.push(this.circle(x, y, size.pointR).attr(style.scores));
                st.push(chartPoints[i]);
            }
        } else if (data.scores.length === 1) {
            // dots for editable chart
            for (i = 0; i < points.length; i += 1) {
                for (var j = 1; j < 6; j += 1) {
                    x = linedOn(cx, points[i][0], j * 0.2);
                    y = linedOn(cy, points[i][1], j * 0.2);
                    var cl = this.circle(x, y, 3.5).attr(style.scores);
                    cl.axis = i;
                    cl.score = j / 5.0;
                    cl.mouseup(mouseUp);
                    cl.mouseout(mouseOut);
                    cl.mouseover(mouseOver);
                    cl.mousedown(mouseDown);
                    st.push(cl);
                }
            }
        }
    } /// end of for(k){} 

    
    for (var i = 0; i < sectorPoints.length; i++) {
        var x = sectorPoints[i][0];
        var y = sectorPoints[i][1];
        var next_i = (i+1)%sectorPoints.length;
        var sector = this.path( ['M',cx,cy,'L',sectorPoints[next_i][0], sectorPoints[next_i][1],
                                 'A', sR, sR, 0,0,0, x,y,
                                 'z']);
         sector.axis = next_i;
         sector.mouseout(mouseOutHighlight);
         sector.mouseover(mouseOverHighlight);
         sector.mouseup(selectAxis); // 5 events might be overkill
         sector.mousedown(selectAxis);
         sector.touchstart(selectAxis);
         sector.touchend(selectAxis);
         sector.touchmove(selectAxis);
        
        st.push( sector.attr({fill:'rgba(0,0,0,0)', 'fill-opacity': 0, stroke:'none'}));
    }//draw inner axes

    directSelect(data.selectedAxis);

    function pulse(index){
        labelHighlights[index].animate({'fill-opacity': 0.29}, 644, function(){
            labelHighlights[index].animate({'fill-opacity': 0}, 644, function(){
                if( labelHighlights[index].pulsing ){ 
                    pulse(index); 
                }else{ // select after pulse is done
                    labelHighlights[data.selectedAxis].animate({'fill-opacity': 0.5}, 300); 
                }
            });
        }); 
    }

    this.carousel = (function(){
        var limit = points.length;
        var index = 0;
        var counter = 0;
        function resetCarousel(lim){
            limit = lim;
            index = 0;
            counter = 0;
        }
        function animateCarousel(){
                labelHighlights[index].animate({'fill-opacity': 0}, 1000);
                index = (index+1)%points.length;
                labelHighlights[index].animate({'fill-opacity': 0.5}, 300);
                if( counter++< limit){ 
                    setTimeout( animateCarousel, 200 ); 
                }else{ 
                    labelHighlights[data.selectedAxis].animate({'fill-opacity': 0.5}, 150);
                }
        }
        return {
                    init: function(lim){
                        resetCarousel(lim);
                        labelHighlights[0].animate({'fill-opacity': 0.5}, 300);
                        animateCarousel();
                    }
                }
    })();

return st;
};
