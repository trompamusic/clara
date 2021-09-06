import React, { Component } from 'react';
import ReactDOM from 'react-dom'

const defaultR = 3; // default point radius
const permissibleQstampGap = 4; // only connect dynamics points not further apart than this

export default class DynamicsVis extends Component {
  constructor(props) { 
    super(props);
    this.state = {
      width: this.props.width || "1280",
      height: this.props.height || "120",
      pointsPerTimeline: {}
    }
    this.setPointsPerTimeline = this.setPointsPerTimeline.bind(this);
    this.dynamicsSvg = React.createRef();
  }

  /* 
   * 1. For each score time:
   *    - Determine timeline instants
   *    - Retrieve their note IDs 
   *    - Group them into layers based on SVG
   *    - Identify max and min for each layer
   *    - Draw points and lines to previous lowest and highest per layer
   */

  componentDidUpdate(prevProps, prevState) { 
    if("currentQstamp" in prevProps && 
      prevProps.currentQstamp !== this.props.currentQstamp) { 
      // current score time has changed, e.g. because playback has progressed
      // clear previously active
      const previouslyActive = ReactDOM.findDOMNode(this.dynamicsSvg.current).querySelectorAll(".active");
      Array.from(previouslyActive).map((p) => p.classList.remove("active"));
      // grab elements on current timeline
      const currentTlElements = ReactDOM.findDOMNode(this.dynamicsSvg.current).querySelectorAll(".currentTl");
      // make those active with a qstamp at or before the currentQstamp
      Array.from(currentTlElements).forEach((e) => { 
        if(parseFloat(e.getAttribute("data-qstamp")) <= this.props.currentQstamp) { 
          e.classList.add("active");
        }
      })
    }
    if("instantsByScoretimeLastModified" in prevProps &&
      prevProps.instantsByScoretimeLastModified !== this.props.instantsByScoretimeLastModified) { 
      // instantsByScoretime changed, e.g. because page has been flipped
      // recalculate points per timeline
        this.setPointsPerTimeline();
    }
  }

  setPointsPerTimeline() { 
    let pointsPerTimeline = {};
    // for each timeline
    this.props.timelinesToVis.forEach( (tl) => { 
      // scoretimes (verovio qtimes) in this timeline:
      let scoretimeArray = Object.keys(this.props.instantsByScoretime[tl]).sort((a,b) => { 
        return parseFloat(a) - parseFloat(b)
      })
      // for each scoretime (qtime)
      scoretimeArray.forEach((qt, qt_ix) => { 
        // extract the corresponding timeline instants
        const instantsAtQt = this.props.instantsByScoretime[tl][qt]
        let performedNoteElementsAtQt = [];
        let instantByNoteElement = {};
        let instantsByQtStaffLayer = {};
        let noteElementsByQtStaffLayer = {};
        instantsAtQt.forEach((inst) => {
          // for MEI elements associated with each instant,
          // determine note element per scoretime AND instant by note element
          const noteElementsAtInstant = this.props.noteElementsForInstant(inst).flat()
          noteElementsAtInstant.forEach( (noteEl) => instantByNoteElement[noteEl.getAttribute("id")] = inst);
          performedNoteElementsAtQt = [...performedNoteElementsAtQt, ...noteElementsAtInstant]
        })
        // arrange instants performed at this qt by the staffs and layers of their note elements
        performedNoteElementsAtQt.forEach((noteElement) => { 
          const staffId = noteElement.closest(".staff").getAttribute("id");
          const layerId = noteElement.closest(".layer").getAttribute("id");

          if(!(staffId in instantsByQtStaffLayer)) {
            instantsByQtStaffLayer[staffId] = {};
            noteElementsByQtStaffLayer[staffId] = {};
          }
          if(layerId in instantsByQtStaffLayer[staffId]) { 
            instantsByQtStaffLayer[staffId][layerId].push(instantByNoteElement[noteElement.getAttribute("id")])
            noteElementsByQtStaffLayer[staffId][layerId].push(noteElement);
          } else { 
            instantsByQtStaffLayer[staffId][layerId] = [ instantByNoteElement[noteElement.getAttribute("id")] ]
            noteElementsByQtStaffLayer[staffId][layerId] = [ noteElement ];
          }
        })
        // Now that we have the performed notes per staff per layer for this Qt, figure out 
        // what to draw in our visualisation.
        // We want to visualise the minimum and maximum velocity, for staffs and for layers-per-staff. 
        // Our x-coords should in each case be the average x-coord of the staff / layer's note elements at this qtime
        // y-coords should correspond to min/max velocity (per staff, or per staff-layer)
        Object.keys(instantsByQtStaffLayer).forEach( (staffId) => {
          Object.keys(instantsByQtStaffLayer[staffId]).forEach( (layerId) => { 
            // pull out and flatten note elements within the staff's layers:
            const staffNoteElements = Object.keys(noteElementsByQtStaffLayer[staffId])
              .map( (layerId) => Object.values(noteElementsByQtStaffLayer[staffId][layerId]) ).flat();
            // figure out avg staff X
            const avgStaffX = staffNoteElements
              .reduce((sumX, note) => { 
                let absolute = this.props.convertCoords(note);
                return sumX + (absolute.x + absolute.x2) / 2;
              }, 0) / staffNoteElements.length;
            // figure out staff min and max velocity (min and max y)
            const staffVelocities = staffNoteElements
              .map( (el) => this.props.performedElements[el.getAttribute("id")][tl] )
            const staffYMin = Math.min(...staffVelocities);
            const staffYMax = Math.max(...staffVelocities);

            // figure out avg X, minY and maxY per staff-layer
            const pointsPerStaffLayer = {}
            Object.keys(noteElementsByQtStaffLayer[staffId]).forEach( (layerId) => {
                // avg X...
                const avgXForThisLayer = noteElementsByQtStaffLayer[staffId][layerId].reduce( (sumX, note) => {
                  let absolute = this.props.convertCoords(note);
                  return sumX + (absolute.x + absolute.x2) / 2;
                }, 0) / noteElementsByQtStaffLayer[staffId][layerId].length;
                // min and max Y...
                const velocitiesForThisLayer = noteElementsByQtStaffLayer[staffId][layerId].map(
                  (el) => this.props.performedElements[el.getAttribute("id")][tl]
                );
                pointsPerStaffLayer[layerId] = { 
                  avgX: avgXForThisLayer,
                  yMin: Math.min(...velocitiesForThisLayer),
                  yMax: Math.max(...velocitiesForThisLayer)
                }
            });

            // now add entries for these points:
            if(!(tl in pointsPerTimeline)) { 
              pointsPerTimeline[tl] = {};
            }
            if(!(qt in pointsPerTimeline[tl])) { 
              pointsPerTimeline[tl][qt] = {};
            }
            pointsPerTimeline[tl][qt][staffId] = { 
              avgX: avgStaffX, 
              yMin: staffYMin, 
              yMax: staffYMax,
              layers: pointsPerStaffLayer
            }
          })
        })
      })
    })
    this.setState({ pointsPerTimeline });
  }

  render() { 
    let svgElements = [];
    let polygons = [];
    let polygonsByStaffLayer = [];
    let dynamicsSummarySvg = [];

    // generate barlines
    Array.from(this.props.barlinesOnPage).forEach((bl,ix) => { 
      const absolute = this.props.convertCoords(bl);
      svgElements.push(
        this.props.makeLine(
          "barLineAttr", // className,
          null, // qstamp - barlines don't need one!
          null, // timeline - barlines don't need one!
          absolute.x, "0", absolute.x, this.state.height, // x1, y1, x2, y2
          "barline-"+ix, // react key
          null  // titleString - barlines don't need one!
        ) 
      )
    }) 

    // generate dynamic (velocity) markers
    const velocityMarkersToDraw = [20, 40, 60,80,100,120];
    velocityMarkersToDraw.forEach((velocity, ix) => {
      svgElements.push(
        this.props.makeLine(
          "velocityMarker", // className
          null, // qstamp - velocityMarker doesn't need one!
          null, // timeline - velocityMarker doesn't need one!
          "0", Math.round(velocity * 50 / 60), this.state.width, Math.round(velocity * 50 / 60), // x1, y1, x2, y2
          "velocity-" + velocity, // reactKey
          velocity + " b.p.m." // title string
        )
      )
      svgElements.push(
          <text key={ velocity + "label" } 
            style={ {fontSize:8, fill:"darkgrey"} }
            // black magic transform... (to compensate for flipped svg coord system)
            transform={ "scale(1, -1) translate(0, -" + Math.round(velocity*0.7 + velocity - 0.9*ix) + ")"}
            x="0" y={ Math.round(velocity*50/60) } 
            className="velocityLabel">
              {velocity }
         </text>
      );
      svgElements.push(
          <text key={ velocity + "label2" } 
            style={ {fontSize:8, fill:"darkgrey"} }
            // black magic transform... (to compensate for flipped svg coord system)
            transform={ "scale(1, -1) translate(0, -" + Math.round(velocity*0.7 + velocity - 0.9*ix) + ")"}
            x={ this.state.width - 40} y={ Math.round(velocity*50/60) } 
            className="velocityLabel">
              {velocity }
         </text>
      );
    })
    // generate points and lines for each timeline, staff, and layer
    // ensure that the currently active timeline (if any) is painted last, to paint over the others
    // (no z-index CSS for SVGs...)
    let timelinesInOrder = this.props.timelinesToVis;
    if(this.props.currentTimeline) {
      const currentTlIndex = timelinesInOrder.indexOf(this.props.currentTimeline);
      if(currentTlIndex > -1) { 
        timelinesInOrder.splice(currentTlIndex,1);
        timelinesInOrder.push(this.props.currentTimeline);
      }
      else { 
        console.warn("FeatureVis: Cannot find current timeline in timelinesToVis");
      }
    }
    timelinesInOrder.forEach((tl) => { 
      let className = tl === this.props.currentTimeline ? "currentTl" : "";
      // for each timeline...
      let maxPoints = []; 
      let minPoints = [];
      let maxLines = [];
      //let minLines = [];
      if(tl in this.state.pointsPerTimeline) { 
        const sortedTlPoints = Object.keys(this.state.pointsPerTimeline[tl]).sort( (a, b) => a-b )
        minPoints = sortedTlPoints.map( (qstamp) => { 
          return Object.keys(this.state.pointsPerTimeline[tl][qstamp]).map( (staffId) => {
            const staff = this.state.pointsPerTimeline[tl][qstamp][staffId];
            const staffNum = this.props.staffmap[staffId]
            const staffPoint = this.props.makePoint(
              className + " staffPoint staff" + staffNum,
              qstamp, 
              tl,
              Math.round(staff.avgX), Math.round(staff.yMin), 
              defaultR, defaultR,
              encodeURIComponent(tl) + "-" + qstamp + "-" + staffId + "-min",
              "Minimum velocity for this staff: " + Math.round(staff.yMin)
            )
            const layerPoints = Object.keys(staff.layers).map( (layerId) => { 
              const point = this.props.makePoint(
                className + "layerPoint staff" + staffNum + " layer" + this.props.stafflayermap[staffId][layerId],
                qstamp,
                tl,
                Math.round(staff.layers[layerId].avgX), Math.round(staff.layers[layerId].yMin),
                defaultR, defaultR,
                encodeURIComponent(tl) + "-" + qstamp + "-" + staffId + "-" + layerId + "-min",
                "Minimum velocity for layer in the staff: " + Math.round(staff.layers[layerId].yMin)
              )
              return point;
            })
            return { staffPoint, layerPoints }
          })
        })
        maxPoints = sortedTlPoints.map( (qstamp) => { 
          return Object.keys(this.state.pointsPerTimeline[tl][qstamp]).map( (staffId) => {
            let staff = this.state.pointsPerTimeline[tl][qstamp][staffId];
            let staffNum = this.props.staffmap[staffId]
            const staffPoint = this.props.makePoint(
              className + " staffPoint staff" + staffNum,
              qstamp, 
              tl,
              Math.round(staff.avgX), Math.round(staff.yMax), 
              defaultR, defaultR,
              encodeURIComponent(tl) + "-" + qstamp + "-" + staffId + "-max",
              "Maximum velocity for this staff: " + Math.round(staff.yMax)
            )
            const layerPoints = Object.keys(staff.layers).map( (layerId) =>  
              this.props.makePoint(
                className + "layerPoint staff" + staffNum + " layer" + this.props.stafflayermap[staffId][layerId],
                qstamp,
                tl,
                Math.round(staff.layers[layerId].avgX), Math.round(staff.layers[layerId].yMax),
                defaultR, defaultR,
                encodeURIComponent(tl) + "-" + qstamp + "-" + staffId + "-" + layerId + "-max",
                "Maximum velocity for layer in the staff: " + Math.round(staff.layers[layerId].yMax)
              )
            )
            return { staffPoint, layerPoints }
          })
        })
        // now connect the points!
/*        minLines = minPoints.map((p, ix) => {
          if(ix < minPoints.length-1) { 
            let from = p[0].staffPoint.props;
            let to = minPoints[ix+1][0].staffPoint.props;
            if(to["data-qstamp"] - from["data-qstamp"] <= permissibleQstampGap) { 
              return this.props.makeLine("dynamicsConnector " + from.className,
                from["data-qstamp"], 
                from.tl, from.cx, from.cy, to.cx, to.cy, 
                "min---" + p[0].staffPoint.key + "---" + minPoints[ix+1][0].key,
                "qstamp from: " + from["data-qstamp"] + " qstamp to: " + to["data-qstamp"]
              );
            } else return false;
          } else return false;
        })
*/
        maxLines = maxPoints.map((p, ix) => {
          if(ix < maxPoints.length-1) { 
            let from = p[0].staffPoint.props;
            let to = maxPoints[ix+1][0].staffPoint.props;
            if(to["data-qstamp"] - from["data-qstamp"] <= permissibleQstampGap) { 
              return this.props.makeLine("dynamicsConnector " + from.className,
                from["data-qstamp"],
                from.tl, from.cx, from.cy, to.cx, to.cy, 
                "max---" + p[0].staffPoint.key + "---" + maxPoints[ix+1][0].key,
                "qstamp from: " + from["data-qstamp"] + "qstamp to: " + to["data-qstamp"]
              );
            } else return false;
          } else return false;
        })
        // connect the points into a polygon
        // we want to envelope each staff along its min and max points
        // order matters! draw a line from the left- to the right-most minimum,
        // then up to the right-most maximum and back to the left-most maximum.
        // We don't need to connect the final (left-most) maximum back to the first
        // (left-most) minimum, as closing the polygon is implied in SVG
        
        // for each staff...
        const staffNums = [...new Set(Object.values(this.props.staffmap))]
        const polygonPointsStringByStaffList = staffNums.map( (staffN) => { 
          const staffId = "staff" + staffN;
          const minPointsForThisStaff = minPoints.filter( (p) => p[0].staffPoint.props.className.split(" ").includes(staffId) )
          const maxPointsForThisStaff = maxPoints.filter( (p) => p[0].staffPoint.props.className.split(" ").includes(staffId) )
          const polygonPointsForThisStaff = [
            ...minPointsForThisStaff.map( (p) => {
              return { x: p[0].staffPoint.props.cx, y: p[0].staffPoint.props.cy } 
            }), 
            ...maxPointsForThisStaff.slice(0).reverse().map( (p) => { 
              return { x: p[0].staffPoint.props.cx, y: p[0].staffPoint.props.cy } 
            })
          ]
          const polygonPointsStringForThisStaff = polygonPointsForThisStaff.reduce(
            (pStr, p) => pStr += p.x + "," + p.y + " ",
          "");
          return { [staffId]: polygonPointsStringForThisStaff }
        })
        const polygonPointsStringByStaff = polygonPointsStringByStaffList
          // turn list of kv pairs into single object
          .reduce( (obj, str) => obj = {...obj, ...str}, {} )
        polygons = [...polygons, ...staffNums.map((staffNum) => {
          const staffId = "staff"+staffNum;
          return this.props.makePolygon(
            className + " " + staffId, 
            tl,
            polygonPointsStringByStaff[staffId],
            "poly" + tl + staffId,
            staffId + " on timeline " + tl
          )
        })]
        /*points = [
          ...minPoints.map((p) => p.staffPoint), 
          ...maxPoints.map((p) => p.staffPoint)
        ];*/

        const polygonPointsStringByStaffLayerList = Array.from(this.props.stafflayertuples).sort().map( (tuple) => {
          const staffId = "staff" + tuple.split(":")[0];
          const layerId = "layer" + tuple.split(":")[1];
          const minPointsForAllStaffLayers = minPoints.map( (p) => p[0].layerPoints).flat();
          const minPointsForThisStaffLayer = minPointsForAllStaffLayers
            .filter((lp) => lp.props.className.split(" ").includes(staffId) &&
                            lp.props.className.split(" ").includes(layerId)
            );
/*          const maxPointsForAllStaffLayers = maxPoints.map( (p) => p[0].layerPoints).flat();
          const maxPointsForThisStaffLayer = maxPointsForAllStaffLayers
            .filter( (lp) => lp.props.className.split(" ").includes(staffId) &&
                               lp.props.className.split(" ").includes(layerId)
            )
*/
          const polygonPointsForThisStaffLayer = [
            ...minPointsForThisStaffLayer.map( (lp) => { 
             return { x: lp.props.cx, y: lp.props.cy }
           })
          ]
          const polygonPointsStringForThisStaffLayer = polygonPointsForThisStaffLayer.flat().reduce(
            (pStr, p) => pStr += p.x + "," + p.y + " ",
          "");
          return { [tuple]: polygonPointsStringForThisStaffLayer }
        })
        const polygonPointsStringByStaffLayer = polygonPointsStringByStaffLayerList
          // turn list of kv pairs into single object
          .reduce( (obj, str) => obj = {...obj, ...str}, {} )
        polygonsByStaffLayer = [...polygonsByStaffLayer, ...Array.from(this.props.stafflayertuples).sort().map( (staffLayer) => { 
          const staffId = "staff" + staffLayer.split(":")[0]
          const layerId= "layer" + staffLayer.split(":")[1]
          return this.props.makePolygon(
            className + " " + staffId + " " + layerId,
            tl,
            polygonPointsStringByStaffLayer[staffLayer],
            "poly" + tl + staffId + layerId,
            staffId + " " + layerId + " on timeline " + tl
          )
        })]

        //lines = [...minLines, ...maxLines];
      }
      // if we haven't added the svgElements to dynamicsSummarySvg yet, do so:
      dynamicsSummarySvg = dynamicsSummarySvg.length ? dynamicsSummarySvg : [...svgElements]
      // fill in this timeline's maxPoints and maxLines
      dynamicsSummarySvg = [
        ...dynamicsSummarySvg, 
        ...maxPoints.map((p) => p[0].staffPoint), 
        ...maxLines
      ]; // dynamics summary
    })
    return(
      <div id="dynamicsVis">
          <div className = { this.props.displayDynamicsSummary ? "" : "removedFromDisplay"} >
            <div className="visLabel"> Dynamics (summary)</div>
            <svg id="dynamicsVisSummary" xmlns="http://www.w3.org/2000/svg" xmlnsXlink="http://www.w3.org/1999/xlink" width={this.state.width} height={this.state.height} transform="scale(1,-1) translate(0, 50)" ref = { this.dynamicsSvg }>
                { dynamicsSummarySvg }
            </svg>
          </div>
        {/* Code to draw legend - maybe no longer required?
        { this.props.displayDynamicsPerStaff.size 
          ? <span id="dynamicsLegend">Staffs on page: 
              { [...new Set(Object.values(this.props.staffmap).sort())].map( (n) => 
                <><span className={"staff" + n}>&nbsp;</span>{n}</>)
              }
             </span>
          : <></>
        }
          */}
        <div className = { this.props.displayDynamicsPerStaff ? "" : "removedFromDisplay" }> 
          { [...this.props.displayDynamicsPerStaff].sort().map( (n) =>  
            <>
              <div className="visLabel"> Dynamics (min/max) for staff {n}</div>
                <svg id={"dynamicsStaff"+n} key={"dynamicsStaff"+n} xmlns="http://www.w3.org/2000/svg" xmlnsXlink="http://www.w3.org/1999/xlink" width={this.state.width} height={this.state.height} transform="scale(1,-1) translate(0, 50)">
                  { [...svgElements, ...polygons.filter((p)=>p.props.className.split(" ").includes("staff"+n))] }
                </svg>
            </>
          ) } 
        </div>
        <div className = { this.props.displayDynamicsPerStaffLayer ? "" : "removedFromDisplay" }> 
          { [...this.props.displayDynamicsPerStaffLayer].sort().map( (tuple) =>  
            <>
              <div className="visLabel"> Dynamics (min/max) for staff { tuple.split(":")[0] } layer {tuple.split(":")[1]}</div>
                <svg id={"dynamicsStaffLayer"+tuple} key={"dynamicsStaffLayer"+tuple} xmlns="http://www.w3.org/2000/svg" xmlnsXlink="http://www.w3.org/1999/xlink" width={this.state.width} height={this.state.height} transform="scale(1,-1) translate(0, 50)">
                  { [...svgElements, ...polygonsByStaffLayer.filter(
                      (p) => p.props.className.split(" ").includes("staff"+tuple.split(":")[0]) &&
                             p.props.className.split(" ").includes("layer"+tuple.split(":")[1])
                  )] }
                </svg>
            </>
          ) } 
        </div>
      </div>
    )
  }
}



