import React, { Component } from 'react';
import ReactDOM from 'react-dom'
import jsonld from 'jsonld'

const defaultY = 80; // for edge-case of only-one-note-on-page

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

  componentDidMount() { 
    console.log("Received performed elements: ", this.props.performedElements);
  }

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
    let pointsPerTimeline={};
    this.props.timelinesToVis.forEach( (tl, ix) => { 
      let scoretimeArray = Object.keys(this.props.instantsByScoretime[tl]).sort((a,b) => { 
        return parseFloat(a) - parseFloat(b)
      })
      // for each instant on this page ...
      let pointsForThisTl = scoretimeArray.map( (qstamp, ix) =>  { 
      // xpos should be average x position for note elements at this qstamp
        let atQstamp = [];
        let pointsByScoretimeByLayer = this.props.instantsByScoretime[tl][qstamp].map((inst) => {
          atQstamp.push({ 
            "noteElements": this.props.noteElementsForInstant(inst),
            "instant": inst
          });

        let sumXPos = atQstamp.flat().reduce((sumX, note) => { 
          let absolute = this.props.convertCoords(note["noteElements"][0]);
          return sumX + absolute.x;
        }, 0);
        let avgXPos = sumXPos / atQstamp.flat().length;

        let currentLayers = {};
        atQstamp.forEach( (el) => { 
          let elInDOM = el["noteElements"][0];
          let elId = elInDOM.getAttribute("id");
          /*let elInDOM = ReactDOM.findDOMNode(
            this.props.scoreComponent.current
          ).querySelector(el["noteElements"][0].getAttribute("id"));
          */
          const layerId = elInDOM.closest(".layer").getAttribute("id");
          if(layerId in currentLayers) { 
            currentLayers[layerId].push(this.props.performedElements[elId]);
          } else { 
            currentLayers[layerId] = [ this.props.performedElements[elId] ];
          }
        })

        
        let layerInformationToDraw = {};
        let pointsPerLayer = Object.keys(currentLayers).map((layer) => { 
          const velocitiesForThisLayer = currentLayers[layer].map((vels) => vels[tl])
          const minDynamic = velocitiesForThisLayer.reduce( (min, current) => {
            if(current < min) { 
              min = current;
            }
            return min;
          })
          const maxDynamic = velocitiesForThisLayer.reduce( (max, current) => { 
            if(current > max) { 
              max = current;
            }
            return max;
          })
          return { x: Math.round(avgXPos), yMin: minDynamic, yMax: maxDynamic, layer: layer, instants:this.props.instantsByScoretime[tl][qstamp]}
         })
        return pointsPerLayer 
        })
      return pointsByScoretimeByLayer
      })
      pointsPerTimeline[tl] = pointsForThisTl;
    })
    this.setState({ pointsPerTimeline });
  }


  render() { 
    if(Object.keys(this.state.pointsPerTimeline).length) {
      console.log("POINTS PER TIMELINE: ", this.state.pointsPerTimeline);
      let svgElements = [];
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
      const velocityMarkersToDraw = [20, 40, 60,80,100,120,140];
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
      // generate points and lines for each timeline and each layer
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
        // for each timeline...
        let lines = [];
        let points = [];
        const tlPoints = this.state.pointsPerTimeline[tl];



/*
        tlPoints.forEach( (pt,ix) => { 
          let instantsString = pt.instants.map((inst) => inst["@id"]).join(",");
          // determine CSS class: "currentTl" if timeline corresponds to selected performance
          // "active" if point is before or equal to the currently active qstamp (in playback)
          let className = tl === this.state.currentTimeline ? "currentTl" : "";
          let prevX = 0;
          let prevY = 0;
          if(ix > 0) { 
            prevX = tlPoints[ix-1].x;
            prevY = tlPoints[ix-1].y;
          }
          if(ix === 0) { 
            // at the first point:
            // no line to previous (because no previous)
            // "steal" Y position from 2nd point (because no iii at first point)
            // UNLESS (edge-case!) it's the only note on page, in which case just invent a tempo (defaultY)
            let stolenY = tlPoints.length === 1 ? defaultY : tlPoints[ix+1].y;
            points.push(
              this.props.makePoint(
                className, 
                pt.qstamp, 
                tl, // timeline
                pt.x, stolenY, "3", "3",  //cx, cy, rx, ry
                "point-"+tl+ix, // react key
                "Point: " + instantsString +" qstamp: " + pt.qstamp // titleString
              )
            )
          } else if(ix === 1) { 
            // at the second point:
            // connect line to "estimated" first point (with stolen Y position)
            // and draw a "normal" point
            lines.push(
              this.props.makeLine(
                className + " estimated",
                pt.qstamp,
                tl, //timeline
                prevX, pt.y, pt.x, pt.y, // x1, y1, x2, y2
                "line-"+tl+ix, // react key
                "Line: " + instantsString + " qstamp: " + pt.qstamp // titleString
              )
            )
            points.push(
              this.props.makePoint(
                className, 
                pt.qstamp, 
                tl, //timeline
                pt.x, pt.y, "3", "3",  //cx, cy, rx, ry
                "point-"+tl+ix, // react key
                "Point: " + instantsString +" qstamp: " + pt.qstamp + " b.p.m.: " + (pt.y / 50 * 60).toFixed(2) // titleString
              )
            )
          } else {
            // "normal" line and point
            lines.push(
              this.props.makeLine(
                className,
                pt.qstamp,
                tl, //timeline
                prevX, prevY, pt.x, pt.y, // x1, y1, x2, y2
                "line-"+tl+ix, // react key
                "Line: " + instantsString + " qstamp: " + pt.qstamp + " b.p.m.: " + (pt.y / 50 * 60).toFixed(2)// titleString
              )
            )
            points.push(
              this.props.makePoint(
                className, 
                pt.qstamp, 
                tl, //timeline
                pt.x, pt.y, "3", "3",  //cx, cy, rx, ry
                "point-"+tl+ix, // react key
                "Point: " + instantsString +" qstamp: " + pt.qstamp + " b.p.m.: " + (pt.y / 50 * 60).toFixed(2)// titleString
              )
            )
          }
        }); */
        // SVGs don't support CSS z-index, so we need to be careful with our ordering:
        // We want whole timelines to be consistent in their z-axis ordering
        // But on a given timeline, we want points to paint over lines.
          svgElements = [...svgElements, lines, points];
        })
      return(
        <svg id="dynamicsVis" xmlns="http://www.w3.org/2000/svg" xmlnsXlink="http://www.w3.org/1999/xlink" width={this.state.width} height={this.state.height} transform="scale(1,-1) translate(0, 50)" ref = { this.dynamicsSvg }>
              { svgElements }
        </svg>
      )
    } else { 
       return ( <div id="dynamicsVisLoading" >Rendering dynamics curves...</div> )
    }
  }
}



