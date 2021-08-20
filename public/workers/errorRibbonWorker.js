function ensureArray(val) { 
  return Array.isArray(val) ? val : [val]
}

function closestValidNote(candidates, embodiments) { 
  return candidates.find( (instant) => 
    ensureArray(instant["http://purl.org/vocab/frbr/core#embodimentOf"])
      .filter( (el) => !(el["@id"].startsWith("https://terms.trompamusic.eu/maps#inserted")) )
      .length > 0
  )
}
function averageScoretime(noteURIs, timemapByNoteId) { 
    // given a list of note elements, calculate their average scoretime
    const noteIds = noteURIs.map((n) => n.substr(n.indexOf("#")+1));
    const knownNotes = noteIds.filter((n) => 
      Object.keys(timemapByNoteId).includes(n)
    )
    if(knownNotes.length) { 
      // return average scoretime (qstamp)
      return knownNotes.map((n) => timemapByNoteId[n].qstamp)
        .reduce( (sum, scoretime) => 
          sum + scoretime
        ) / knownNotes.length
    } else { 
      console.warn("Attempting to calculate average scoretime without known notes: ", noteIds);
    }
  }

onmessage = (e) => { 
  const props = e.data;
  let contextualisedInsertedNotes = {};
  let insertedNotesByScoretime = {};
  props.timelinesToVis.forEach( (tl, ix) => { 
    if(tl in props.performanceErrors && "inserted" in props.performanceErrors[tl]) { // we have inserted notes
      // ensure ALL performed instants (correct and inserted notes) are sorted by time
      const orderedInstants = props.instantsByPerfTime[tl].slice(0).sort( (a, b) =>  {
        const instantTimeStringA = a["http://purl.org/NET/c4dm/timeline.owl#at"];
        const instantTimeA = parseFloat(instantTimeStringA.substr(1, instantTimeStringA.length-2));
        const instantTimeStringB = b["http://purl.org/NET/c4dm/timeline.owl#at"];
        const instantTimeB = parseFloat(instantTimeStringB.substr(1, instantTimeStringB.length-2));
        return instantTimeA - instantTimeB;
      });
      // locate the inserted notes within their performance context
      const insertedWithIndices = props.performanceErrors[tl].inserted.map( (inserted) => { 
        return {
          index: orderedInstants.findIndex( (instant) => instant["http://purl.org/NET/c4dm/timeline.owl#at"] === 
                               inserted["http://purl.org/NET/c4dm/timeline.owl#at"]
                ),
          instant: inserted
        }
      }) 
      console.log("INSERTED WITH INDICES FOR TL ", ix, " ", insertedWithIndices)
      contextualisedInsertedNotes[tl] = insertedWithIndices.map((inserted) => { 
        let averageScoretime;
        const validNotesAtIndex = ensureArray(inserted.instant["http://purl.org/vocab/frbr/core#embodimentOf"])
          .filter((el) => !(el["@id"].startsWith("https://terms.trompamusic.eu/maps#inserted")))
        if(validNotesAtIndex.length) { 
          // if there is a non-inserted note at that index, use its score time
          averageScoretime = this.averageScoretime(validNotesAtIndex, props.timemapByNoteId);
        } else{
          // otherwise, approximate a score time based on preceding and succeeding non-inserted notes
          let closestValidPredecessorNotes = [];
          let closestValidSuccessorNotes = [];
          const predecessors = orderedInstants.slice(0, inserted.index-1).reverse();
          const closestValidPredecessorInstant = closestValidNote(predecessors);
          if(closestValidPredecessorInstant) { 
            closestValidPredecessorNotes = ensureArray(closestValidPredecessorInstant["http://purl.org/vocab/frbr/core#embodimentOf"])
            .map((embodiment) => embodiment["@id"])
            .filter((id) => !(id.startsWith("https://terms.trompamusic.eu/maps#inserted")));
          }
          const successors = orderedInstants.slice(inserted.index+1);
          const closestValidSuccessorInstant= closestValidNote(successors);
          if(closestValidSuccessorInstant) { 
            closestValidSuccessorNotes = ensureArray(closestValidSuccessorInstant["http://purl.org/vocab/frbr/core#embodimentOf"])
              .map((embodiment) => embodiment["@id"])
              .filter((id) => !(id.startsWith("https://terms.trompamusic.eu/maps#inserted")));
          }
          averageScoretime = this.averageScoretime([...closestValidPredecessorNotes, ...closestValidSuccessorNotes], props.timemapByNoteId);
        }
        inserted["approxScoretime"] = averageScoretime;
        return inserted;
      })
      insertedNotesByScoretime[tl] = Object.keys(contextualisedInsertedNotes[tl]).map((n) => {
        return { [contextualisedInsertedNotes[tl][n].approxScoretime]: contextualisedInsertedNotes[tl][n].instant }
      })
    }
    });
    postMessage({insertedNotesByScoretime});
}
