import React, { Component } from 'react';
import Companion from './companion';

export default class PieceSelection extends Component {
  constructor(props) { 
    super(props);
    this.state = { 
      selectedPiece: "",
      test: ""
    }
    this.handlePieceSelected = this.handlePieceSelected.bind(this);
    this.eventSource = new EventSource("http://localhost/sservant") // event source for real-time server-sent events (SSE)
  }

  handlePieceSelected(e) { 
    const selected = e.target.value;
    console.log("Piece selected: ", selected);
    this.setState({"selectedPiece": selected});
  }

  componentDidMount() {
    this.eventSource.onopen = e => { 
      console.log("Received SSE open: ", e)
      //this.ingestInstantsToTimeline(JSON.parse(e.data));
    }
    this.eventSource.onmessage = e => { 
      console.log("Received SSE message: ", e)
      this.setState({test: this.state.test += " " +e.data});
      //this.ingestInstantsToTimeline(JSON.parse(e.data));
    }
    this.eventSource.onerror = e => { 
      console.log("Received SSE error: ", e)
      //this.ingestInstantsToTimeline(JSON.parse(e.data));
    }
  }

  render() { 
    return(
      <div>
        { this.state.selectedPiece
          ? <Companion uri={ this.state.selectedPiece } />
          : <div> Please make a piece selection </div>
        }
        <div>Message: { this.state.test }</div>
        <select name="pieceSelect" onChange={ this.handlePieceSelected }>
          <option value="">Select a piece...</option>
          <option key="http://localhost:8080/performance/WoO80-new.json"  value="http://localhost:8080/performance/WoO80-new.json"> WoO 80</option>
          <option key="http://localhost:8080/performance/Op126Nr3.json"  value="http://localhost:8080/performance/Op126Nr3.json">Op 126 Nr 3</option>
        </select>
      </div>
    )
  }
}
