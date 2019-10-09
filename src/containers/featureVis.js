import React, { Component } from 'react';
import ReactDOM from 'react-dom'
import { connect } from 'react-redux' ;
import { bindActionCreators } from 'redux';

//const {Raphael,Paper,Set,Circle,Ellipse,Image,Rect,Text,Path,Line} = require('react-raphael');

class FeatureVis extends Component {
  constructor(props) {
    super(props);
    this.state = { 
      width: this.props.width || 100,
      height: this.props.height || 100,
      instantsOnPage: {},
      noteElementsByNoteId: {}
    }
    this.setInstantsOnPage = this.setInstantsOnPage.bind(this);
    this.setNoteElementsByNoteId = this.setNoteElementsByNoteId.bind(this);
    this.ensureArray = this.ensureArray.bind(this);
  }

/*
  componentDidMount(){ 
    if(Object.keys(this.props.instantsByNoteId).length) { 
      const notes = this.props.notes;
      let instantsOnPage = {};
      // for each timeline we need to visualise:
      this.props.timelinesToVis.map( (tl) => { 
//        console.log("Notes on page: ", this.props.notesOnPage);
        // find the instants coresponding to notes on this page
        instantsOnPage[tl] = Array.from(this.props.notesOnPage).map( (note) => { 
          //console.log("Looking at note: ", note);
          return this.props.instantsByNoteId[tl][note.getAttribute("id")]
        })
      })
      console.log("Instants on page: ", instantsOnPage);
    } else { 
      console.log("FeatureVis mounted without notesOnPage")
    }
  }
*/
  componentDidMount() { 
    this.setNoteElementsByNoteId();
    this.setInstantsOnPage();
  }

  componentDidUpdate(prevProps, prevState) { 
    if("score" in prevProps && prevProps.score.pageNum !== this.props.score.pageNum  // page flipped
    ) { 
      this.setNoteElementsByNoteId();
      this.setInstantsOnPage();
    }
  }

  setNoteElementsByNoteId() { 
    let noteElementsByNoteId = {};
    Array.from(this.props.notesOnPage).map( (note) => {
      noteElementsByNoteId[note.getAttribute("id")] = note;
    })
    this.setState({ noteElementsByNoteId });
  }
      

  setInstantsOnPage() { 
    if(Object.keys(this.props.instantsByNoteId).length) { 
      let instantsOnPage = {};
      // for each timeline we need to visualise:
      this.props.timelinesToVis.map( (tl) => { 
//        console.log("Notes on page: ", this.props.notesOnPage);
        // find the instants coresponding to notes on this page
        instantsOnPage[tl] = Array.from(this.props.notesOnPage).map( (note) => { 
          return this.props.instantsByNoteId[tl][note.getAttribute("id")]
        }).filter( (inst) => {
          // filter out undefined instants (i.e. when note doesn't appear in timeline)
          return inst

        })
      })
      this.setState({instantsOnPage}, () => { console.log("SET!")})
    }
  }
  
  ensureArray(val) { 
    return Array.isArray(val) ? val : [val]
  }

  render() {
    if(Object.keys(this.state.instantsOnPage).length) { 
      const rects = this.props.timelinesToVis.map( (tl, ix) => { 
        // for each instant on this page ...
        let rectsForThisTl = this.state.instantsOnPage[tl].map( (inst, ix) => { 
          //$tmp.reduce((sumX, note) => sumX + parseFloat(note["http://purl.org/NET/c4dm/timeline.owl#atDuration"].replace(/[PS]/g, "")),0) 
          let noteElements = this.ensureArray(inst["http://purl.org/vocab/frbr/core#embodimentOf"]).map( (n) => { 
            // return note (DOM) elements corresponding to each embodiment
            return this.state.noteElementsByNoteId[n["@id"].substr(n["@id"].lastIndexOf("#")+1)]
          })
          let sumXPos = noteElements.filter( (note) => { 
            // filter out undefined notes (deleted notes might not be notesOnPage)
            return note
          }).reduce((sumX, note) => { 
            // sum the x-positions of the notes of this instant
            let noteId = note.getAttribute("id");
            noteId = noteId.substr(noteId.lastIndexOf("#")+1);
            let noteElement = this.state.noteElementsByNoteId[noteId];
            return sumX + noteElement.getBBox().x
          }, 0);
          // find their average
          let averageXPos = Math.floor(sumXPos / this.ensureArray(inst["http://purl.org/vocab/frbr/core#embodimentOf"]).length)
          // calculate y position (default to 0 on first instant)
          /*
          let yPos = 0;
          if(ix > 0) { 
            deltaT = inst["http://purl.org/NET/c4dm/timeline.owl#atDuration"].replace(/[PS]/g, "")0

          }
          */
          
          // return rectangle for this timeline adn instant
          return <rect x={averageXPos} y="1000" height="100" width="100" viewBox="0 0 1000 1000" style={ {stroke:"#009900", fill: "#00cc00"} } id={ inst["@id"] } key = { inst["@id"]+"_" +ix }/>
        })
        return rectsForThisTl;
      })
      console.log("Rects: ", rects);
      return (
        // for each timeline...
        <svg xmlns="http://www.w3.org/2000/svg" xmlnsXlink="http://www.w3.org/1999/xlink" width="1800.00px" height="100.00px" >
          <svg viewBox="0 0 40000 6280">
            <g transform="translate(500, 500)">
              { rects[0] }
            </g>
          </svg>
        </svg>
      )
    } else { 
      return ( <div>No SVG or you!</div> )
      //<Paper width={ this.state.width } height={ this.state.height }>
      //  <Set>
      //    <Rect x={30} y={148} width={240} height={150} attr={{"fill":"#10a54a","stroke":"#f0c620","stroke-width":5}}/>
      //  </Set>
      //</Paper>
    }
  }
}

function mapStateToProps({ graph, score }) {
  return { graph, score }
}

function mapDispatchToProps(dispatch) { 
  return bindActionCreators( { 
    }, dispatch);
}

export default connect(mapStateToProps, mapDispatchToProps)(FeatureVis);
