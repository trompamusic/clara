import { ReactNode } from "react";
import DragSelect from "dragselect";

export interface ScoreData {
  pageState: {
    [key: string]: {
      currentPage: number;
    };
  };
  MEI: {
    [key: string]: any;
  };
  SVG: Record<string, any>;
  vrvTk?: any;
}

export interface ScoreState {
  score: ScoreData;
}

export interface ScorePageProps {
  uri: string;
  buttonContent?: ReactNode;
}

export interface NextPageDispatchProps {
  scoreNextPageStatic: (uri: string, currentPage: number, mei: any) => void;
}

export interface PrevPageDispatchProps {
  scorePrevPageStatic: (uri: string, currentPage: number, mei: any) => void;
}

export interface VrvOptions {
  scale: number;
  adjustPageHeight: number;
  pageHeight: number;
  pageWidth: number;
  footer: string;
  unit: number;
  [key: string]: any;
}

export interface SelectableScoreProps {
  uri: string;
  vrvOptions?: VrvOptions;
  selectorString?: string;
  selectionArea?: string;
  onScoreUpdate?: (svg: SVGElement) => void;
  onSelectionChange?: (elements: Element[]) => void;
  onScoreReady?: (svg: SVGElement, vrvTk: any) => void;
  annotationContainerUri?: string;
  toggleAnnotationRetrieval?: boolean;
  onReceiveAnnotationContainerContent?: (content: any) => void;
  score: ScoreData;
  scoreSetOptions: (uri: string, options: VrvOptions) => void;
}

export interface SelectableScoreState {
  selectorString: string;
  selectionArea: string;
  scoreComponentLoaded: boolean;
  annotationContainerContentToRetrieve: string[];
  vrvOptions: VrvOptions;
  selector?: DragSelect;
}

export interface SelectableScoreDispatchProps {
  scoreSetOptions: (uri: string, options: VrvOptions) => void;
}
