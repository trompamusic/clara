import React from "react";

type FeatureVisControlsProps = {
  displayTempoCurves: boolean;
  displayErrorRibbon: boolean;
  displayDynamicsSummary: boolean;
  displayDynamicsPerStaff: Set<string>;
  displayDynamicsPerStaffLayer: Set<string>;
  staffmap: Record<string, string>;
  stafflayertuples: Set<string>;
  onToggleTempoCurves: () => void;
  onToggleErrorRibbon: () => void;
  onToggleDynamicsSummary: () => void;
  onTogglePerStaff: (n: string) => void;
  onSelectAllPerStaff: () => void;
  onSelectNonePerStaff: () => void;
  onTogglePerStaffLayer: (n: string) => void;
  onSelectAllPerStaffLayer: () => void;
  onSelectNonePerStaffLayer: () => void;
};

export default function FeatureVisControls(props: FeatureVisControlsProps) {
  const staffNumbers = React.useMemo(
    () => Array.from(new Set(Object.values(props.staffmap))).sort(),
    [props.staffmap],
  );
  const staffLayerTuples = React.useMemo(
    () => Array.from(props.stafflayertuples).sort(),
    [props.stafflayertuples],
  );

  return (
    <div id="featureVisControls">
      Features to visualise:
      <input
        type="checkbox"
        checked={props.displayTempoCurves}
        onChange={props.onToggleTempoCurves}
      />{" "}
      Tempo curves
      <input
        type="checkbox"
        checked={props.displayErrorRibbon}
        onChange={props.onToggleErrorRibbon}
      />{" "}
      Error visualisation
      <input
        type="checkbox"
        checked={props.displayDynamicsSummary}
        onChange={props.onToggleDynamicsSummary}
      />{" "}
      Max dynamics (summary) &nbsp;
      <div id="dynamicsPerStaffControls">
        Dynamics per staff:
        {staffNumbers.map((n) => (
          <span key={"dynamicsPerStaffCheckboxWrapper" + n}>
            <input
              type="checkbox"
              checked={props.displayDynamicsPerStaff.has(n)}
              key={"dynamicsPerStaffCheckbox" + n}
              onChange={() => props.onTogglePerStaff(n)}
            />
            {n}
          </span>
        ))}
        <span
          className="selectDynamicsAggregate"
          id="selectAllDynamics"
          onClick={props.onSelectAllPerStaff}
        >
          All
        </span>
        <span
          className="selectDynamicsAggregate"
          id="selectNoDynamics"
          onClick={props.onSelectNonePerStaff}
        >
          None
        </span>
      </div>
      <div id="dynamicsPerStaffLayerControls">
        Detailed dynamics per staff and layer:
        {staffLayerTuples.map((n) => (
          <span key={"dynamicsPerStaffLayerCheckboxWrapper" + n}>
            <input
              type="checkbox"
              checked={props.displayDynamicsPerStaffLayer.has(n)}
              key={"dynamicsPerStaffLayerCheckbox" + n}
              onChange={() => props.onTogglePerStaffLayer(n)}
            />
            {n}
          </span>
        ))}
        <span
          className="selectDynamicsAggregate"
          id="selectAllStaffLayerDynamics"
          onClick={props.onSelectAllPerStaffLayer}
        >
          All
        </span>
        <span
          className="selectDynamicsAggregate"
          id="selectNoStaffLayerDynamics"
          onClick={props.onSelectNonePerStaffLayer}
        >
          None
        </span>
      </div>
    </div>
  );
}
