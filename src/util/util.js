export function convertCoords(elem) {
  // https://stackoverflow.com/questions/26049488/how-to-get-absolute-coordinates-of-object-inside-a-g-group
  if (
    !!elem &&
    document.getElementById(elem.getAttribute("id")) &&
    elem.style.display !== "none" &&
    (elem.getBBox().x !== 0 || elem.getBBox().y !== 0)
  ) {
    const x = elem.getBBox().x;
    const width = elem.getBBox().width;
    const y = elem.getBBox().y;
    const height = elem.getBBox().height;
    const offset = elem.closest("svg").parentElement.getBoundingClientRect();
    const matrix = elem.getScreenCTM();
    return {
      x: matrix.a * x + matrix.c * y + matrix.e - offset.left,
      y: matrix.b * x + matrix.d * y + matrix.f - offset.top,
      x2: matrix.a * (x + width) + matrix.c * y + matrix.e - offset.left,
      y2: matrix.b * x + matrix.d * (y + height) + matrix.f - offset.top,
    };
  } else {
    console.warn("Element unavailable on page: ", elem.getAttribute("id"));
    return { x: 0, y: 0, x2: 0, y2: 0 };
  }
}

export function closestClef(noteid) {
  let clef;
  const note = document.querySelector("#" + noteid);
  if (!!!note) {
    console.warn("closestClef called with non-existant note id: ", noteid);
    return null;
  }
  const staff = note.closest(".staff");
  const staves = Array.from(document.querySelectorAll(".staff"));

  if (!!staff) {
    let check = false;
    let found = false;
    // walk backwards through the staves until we hit one with clef(s)
    staves.reverse().forEach((s) => {
      if (!found) {
        if (s.getAttribute("id") === staff.getAttribute("id")) {
          check = true;
        }
        if (check) {
          let clefs = s.querySelectorAll(".clef");
          let distanceToNote = 999999;
          clefs.forEach((c) => {
            // look for the closest clef positioned to the left of our note
            // i.e., the smallest positive distanceToNote
            const d =
              note.getBoundingClientRect().x - c.getBoundingClientRect().x;
            if (d > 0 && d < distanceToNote) {
              // this clef is the closest we've found so far
              distanceToNote = d;
              clef = c;
            }
          });
          if (!!clef) {
            found = true;
          }
        }
      }
    });
  }
  return clef;
}
