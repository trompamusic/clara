#!/bin/bash
for file in data/Results/*.json; do
  # for each participant
  pID=$(echo $file | sed -E 's/.*(P[0-9]+).boe.*/\1/')
  # generate json and ttl files
#  python utils/convert_to_rdf.py -m $file -s http://localhost:8080/structure/WoO80-notes -t http://localhost:8080/timeline/BeethovenWettbewerb/$pID-notes -u http://localhost:8080/Beethoven_WoO80-32-Variationen-c-Moll.mei -f both -o $pID-notes
  # append the .json or .ttl suffix as appropriate
#  sed -i -e "s/$pID-notes/$pID-notes.ttl/g" $pID-notes.ttl
#  sed -i -e "s/$pID-notes/$pID-notes.json/g" $pID-notes.json
  # find the line for this participant in the offsets file:
  echo "PID: $pID"
  offsetLine=$(grep $pID MIDI-Offsets-WoO80.tsv)
  firstName=$(echo "$offsetLine"| cut -f1)
  surName=$(echo "$offsetLine"| cut -f2)
  name=$(echo "$firstName $surName")
  video=$(echo "$offsetLine"| cut -f3)
  offset=$(echo "$offsetLine"| cut -f5)
  #read the performance description
  echo "$firstName $surName $video $offset"
  perfTemplate=$(<performanceTemplate.json)
  perfTemplate=$(echo $perfTemplate | sed -E "s/!VIDEO!/$video/g")
  perfTemplate=$(echo $perfTemplate | sed -E "s/!NAME!/$name/g")
  perfTemplate=$(echo $perfTemplate | sed -E "s/!PID!/$pID/g")
  perfTemplate=$(echo $perfTemplate | sed -E "s/!OFFSET!/$offset/g")
  echo $perfTemplate > $pID-performance.json
done
