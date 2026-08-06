import React from "react";
import { Form } from "react-bootstrap";

export const NO_EXPANSION = "no expansion";

// The backend treats an absent expansion as "none"; the sentinel is UI-only
export const toApiExpansion = (expansion: string): string | undefined =>
  expansion === NO_EXPANSION ? undefined : expansion;

interface PerformanceMetadataFieldsProps {
  idPrefix: string;
  label: string;
  expansion: string;
  onLabelChange: (label: string) => void;
  onExpansionChange: (expansion: string) => void;
  expansionOptions: string[];
}

const PerformanceMetadataFields: React.FC<PerformanceMetadataFieldsProps> = ({
  idPrefix,
  label,
  expansion,
  onLabelChange,
  onExpansionChange,
  expansionOptions,
}) => {
  const normalizedExpansionOptions = [
    NO_EXPANSION,
    ...expansionOptions.filter((option) => option !== NO_EXPANSION),
  ];

  return (
    <>
      <Form.Group className="mb-3">
        <Form.Label htmlFor={`${idPrefix}-label`}>
          Label for this performance:
        </Form.Label>
        <Form.Control
          id={`${idPrefix}-label`}
          type="text"
          value={label}
          onChange={(e) => onLabelChange(e.target.value)}
          placeholder="e.g., 'Morning practice session'"
        />
      </Form.Group>

      <Form.Group className="mb-3">
        <Form.Label htmlFor={`${idPrefix}-expansion`}>
          Select expansion:
        </Form.Label>
        <Form.Select
          id={`${idPrefix}-expansion`}
          value={expansion}
          onChange={(e) => onExpansionChange(e.target.value)}
        >
          {normalizedExpansionOptions.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </Form.Select>
      </Form.Group>
    </>
  );
};

export default PerformanceMetadataFields;
