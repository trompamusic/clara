declare module 'meld-clients-core/lib/actions';

declare module 'meld-clients-core/lib/actions/index' {
  export function setFetchFunction(fetch: any): {
    type: string;
    payload: {
      fetch: any;
    };
  };

  export function scoreNextPageStatic(uri: string, currentPage: number, mei: any): {
    type: string;
    payload: {
      uri: string;
      pageNum: number;
      mei: any;
    };
  };

  export function scorePrevPageStatic(uri: string, currentPage: number, mei: any): {
    type: string;
    payload: {
      uri: string;
      pageNum: number;
      mei: any;
    };
  };

  export function postAnnotation(
    submitUri: string,
    motivation: string,
    body: any,
    target: string,
    callback: (response: any) => void
  ): {
    type: string;
    payload: {
      submitUri: string;
      motivation: string;
      body: any;
      target: string;
      callback: (response: any) => void;
    };
  };

  export function scoreSetOptions(
    uri: string,
    options: {
      scale?: number;
      adjustPageHeight?: number;
      pageHeight?: number;
      pageWidth?: number;
      footer?: string;
      unit?: number;
      [key: string]: any;
    }
  ): {
    type: string;
    payload: {
      uri: string;
      options: any;
    };
  };
}

declare module 'meld-clients-core/lib/containers/score' {
  import { Component } from 'react';

  interface ScoreProps {
    uri: string;
    key?: string;
    options?: {
      scale?: number;
      adjustPageHeight?: number;
      pageHeight?: number;
      pageWidth?: number;
      footer?: string;
      unit?: number;
      [key: string]: any;
    };
  }

  class Score extends Component<ScoreProps> {}

  export default Score;
}

declare module 'dragselect' {
  export interface DragSelectOptions {
    selectables?: Element[] | NodeListOf<Element>;
    area?: HTMLElement;
    selectedClass?: string;
    onDragStartBegin?: () => void;
    callback?: (elements: Element[]) => void;
    [key: string]: any;
  }

  class DragSelect {
    constructor(options: DragSelectOptions);
    stop(): void;
  }

  export default DragSelect;
}