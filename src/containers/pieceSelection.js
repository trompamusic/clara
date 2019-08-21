import React, { Component } from 'react';
import Companion from './companion';

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
        <select name="pieceSelect" onChange={ this.handlePieceSelected }>
          <option value="">Select a piece...</option>
          <option key="http://localhost:8080/performance/BeethovenWettbewerb/WoO80-all.json"  value="http://localhost:8080/performance/BeethovenWettbewerb/WoO80-all.json"> WoO 80</option>
          <option key="http://localhost:8080/performance/BeethovenWettbewerb/Op126Nr3-all.json"  value="http://localhost:8080/performance/BeethovenWettbewerb/Op126Nr3-all.json" onChange={this.handlePieceSelected}>Op 126 Nr 3</option>
        </select>
      </div>
    )
  }
}
