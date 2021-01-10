import React, { Component } from 'react';
import ReactDOM from 'react-dom'
import jsonld from 'jsonld'

const defaultR = 3; // default point radius

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
    let instantsByTimelineScoretimeLayer = {};
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
        let instantsByQtLayer = {}
        let noteElementsByQtLayer = {}
        instantsAtQt.forEach((inst) => {
          // for MEI elements associated with each instant,
          // determine note element per scoretime AND instant by note element
          const noteElementsAtInstant = this.props.noteElementsForInstant(inst).flat()
          noteElementsAtInstant.forEach( (noteEl) => instantByNoteElement[noteEl.getAttribute("id")] = inst);
          performedNoteElementsAtQt = [...performedNoteElementsAtQt, ...noteElementsAtInstant]
        })
        // arrange instants performed at this qt by the layers of their note elements
        performedNoteElementsAtQt.forEach((noteElement) => { 
          const layerId = noteElement.closest(".layer").getAttribute("id");
          if(layerId in instantsByQtLayer) { 
            instantsByQtLayer[layerId].push(instantByNoteElement[noteElement.getAttribute("id")])
            noteElementsByQtLayer[layerId].push(noteElement);
          } else { 
            instantsByQtLayer[layerId] = [ instantByNoteElement[noteElement.getAttribute("id")] ]
            noteElementsByQtLayer[layerId] = [ noteElement ];
          }
        })
        // Now that we have the performed notes per layer for this Qt, figure out 
        // what to draw in our visualisation.
        // We want to visualise the minimum and maximum velocity. Our x-coord for both
        // should be the average x-coord of the layer's note elements at this qtime
        Object.keys(instantsByQtLayer).forEach( (layerId) => {
          const avgX = noteElementsByQtLayer[layerId].reduce((sumX, note) => { 
            let absolute = this.props.convertCoords(note);
            return sumX + absolute.x;
          }, 0) / noteElementsByQtLayer[layerId].length;
          const localVelocities = noteElementsByQtLayer[layerId].map(
            (el) => this.props.performedElements[el.getAttribute("id")][tl]
          )
          const yMin = Math.min(...localVelocities);
          const yMax = Math.max(...localVelocities);
          // now add an entry for these points:
          if(tl in pointsPerTimeline) { 
            if(qt in pointsPerTimeline) { 
              pointsPerTimeline[tl][qt][layerId] = { avgX, yMin, yMax }
            } else { 
              pointsPerTimeline[tl][qt] = { [layerId]: { avgX, yMin, yMax } }
            }
          } else { 
            pointsPerTimeline[tl] = { [qt]: { [layerId]: { avgX, yMin, yMax } } }
          }
        })
      })
    })
    this.setState({ pointsPerTimeline });
  }

  render() { 
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
      let className = tl === this.state.currentTimeline ? "currentTl" : "";
      // for each timeline...
      let lines = [];
      let points = [];
      if(tl in this.state.pointsPerTimeline) { 
        const minPoints = Object.keys(this.state.pointsPerTimeline[tl]).map( (qstamp) => { 
          return Object.keys(this.state.pointsPerTimeline[tl][qstamp]).map( (layerId) => {
            let layer = this.state.pointsPerTimeline[tl][qstamp][layerId];
            return this.props.makePoint(
              className + " " + layerId + " min",
              qstamp, 
              tl,
              Math.round(layer.avgX), Math.round(layer.yMin), 
              defaultR, defaultR,
              encodeURIComponent(tl) + "-" + qstamp + "-" + layerId,
              "Minimum velocity for this layer: ", Math.round(layer.yMin)
            )
          })
        })
        const maxPoints = Object.keys(this.state.pointsPerTimeline[tl]).map( (qstamp) => { 
          return Object.keys(this.state.pointsPerTimeline[tl][qstamp]).map( (layerId) => {
            let layer = this.state.pointsPerTimeline[tl][qstamp][layerId];
            return this.props.makePoint(
              className + " " + layerId + " max",
              qstamp, 
              tl,
              Math.round(layer.avgX), Math.round(layer.yMax), 
              defaultR, defaultR,
              encodeURIComponent(tl) + "-" + qstamp + "-" + layerId,
              encodeURIComponent(tl) + "-" + qstamp + "-" + layerId,
              "Maximum velocity for this layer: ", Math.round(layer.yMax)
            )
          })
        })
        // now connect the points!
        const minLines = minPoints.map((p, ix) => {
          if(ix < minPoints.length-1) { 
            let from = p[0].props;
            let to = minPoints[ix+1][0].props;
            return this.props.makeLine("dynamicsConnector",
              from.qstamp, 
              from.tl, from.cx, from.cy, to.cx, to.cy, 
              "min---" + p[0].key + "---" + minPoints[ix+1][0].key,
              ""
            );
          }
        })
        const maxLines = maxPoints.map((p, ix) => {
          if(ix < maxPoints.length-1) { 
            let from = p[0].props;
            let to = maxPoints[ix+1][0].props;
            return this.props.makeLine("dynamicsConnector",
              from.qstamp,
              from.tl, from.cx, from.cy, to.cx, to.cy, 
              "max---" + p[0].key + "---" + maxPoints[ix+1][0].key,
              ""
            );
          }
        })
        points = [...minPoints, ...maxPoints];
        lines = [...minLines, ...maxLines];
      }
      svgElements = [...svgElements, ...points, ...lines];
    })
    return(
      <svg id="dynamicsVis" xmlns="http://www.w3.org/2000/svg" xmlnsXlink="http://www.w3.org/1999/xlink" width={this.state.width} height={this.state.height} transform="scale(1,-1) translate(0, 50)" ref = { this.dynamicsSvg }>
            { svgElements }
      </svg>
    )
  }
}



