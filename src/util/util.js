export function closestClef(noteid) { 
  let clef;
  const note = document.querySelector("#" + noteid);
  if(!(!!note)) { 
  	console.warn("closestClef called with non-existant note id: ", noteid);
    return null;
  }
  const staff = note.closest(".staff");
  const staves = Array.from(document.querySelectorAll(".staff"));
  
  if(!!staff) { 
    let check = false;
    let found = false
    // walk backwards through the staves until we hit one with clef(s)
    staves.reverse().forEach(s => {
      if(!found) {
        if(s.getAttribute("id") === staff.getAttribute("id")) { 
          check = true;
        }  
        if(check) {
          let clefs = s.querySelectorAll(".clef")
          let distanceToNote = 999999;
          clefs.forEach((c) => { 
            // look for the closest clef positioned to the left of our note
            // i.e., the smallest positive distanceToNote
            const d = note.getBoundingClientRect().x - c.getBoundingClientRect().x;
            if(d > 0 && d < distanceToNote) { 
              // this clef is the closest we've found so far
              distanceToNote = d;
              clef = c;
            }
          })
          if(!!clef) { found = true }
        }
      }
    })
  }
  return clef;
}




