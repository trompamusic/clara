import React, { Component } from 'react';
import Companion from './realtimeCompanion';

export default class PieceSelection extends Component {
  constructor(props) { 
    super(props);
    this.state = { 
      selectedPiece: ""
    }
    this.handlePieceSelected = this.handlePieceSelected.bind(this);
  }

  handlePieceSelected(e) { 
    const selected = e.target.value;
    console.log("Piece selected: ", selected);
    this.setState({"selectedPiece": selected});
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
          <option key="http://localhost/performance/Mozart_K265_1-realtime-container.json"  value="http://localhost/performance/twinkle-realtime-container.json">Twinkle</option>
          <option key="http://localhost/performance/Mozart_K265_1-realtime-container.json"  value="http://localhost/performance/Mozart_K265_1-realtime-container.json">W. A. Mozart - K265 Var 1</option>
          <option key="http://localhost/performance/WoO80-realtime-container.json"  value="http://localhost/performance/WoO80-realtime-container.json">L. van Beethoven - WoO 80</option>
          <option key="http://localhost/performance/Op126Nr3-realtime.json"  value="http://localhost/performance/Op126Nr3-realtime.json">L. van Beethoven - Op 126 Nr 3</option>
          <option key="http://localhost/performance/CSchumann-realtime-container.json"  value="http://localhost/performance/CSchumann-realtime-container.json">C. Schumann - Romanze ohne Opuszahl</option>
        </select>
      </div>
    )
  }
}
