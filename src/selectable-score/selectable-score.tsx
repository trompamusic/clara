import React, { useEffect, useRef, useState, useCallback } from "react";
import ReactDOM from "react-dom";
import { connect } from "react-redux";
import { bindActionCreators, Dispatch } from "redux";
import Score from "meld-clients-core/lib/containers/score";
import { scoreSetOptions } from "meld-clients-core/lib/actions/index";
import DragSelect from "dragselect/dist/DragSelect";
import { fetch } from "@inrupt/solid-client-authn-browser";
import { ScoreState, SelectableScoreProps, VrvOptions } from "./types";

const CONTAINS = "http://www.w3.org/ns/ldp#contains";

const defaultVrvOptions: VrvOptions = {
  scale: 45,
  adjustPageHeight: 1,
  pageHeight: 2500,
  pageWidth: 2200,
  footer: "none",
  unit: 6,
};

const defaultSelectorString = ".note";
const defaultSelectionArea = ".score";

const SelectableScore: React.FC<SelectableScoreProps> = (props) => {
  const {
    uri,
    score,
    scoreSetOptions,
    onScoreUpdate,
    onSelectionChange,
    onScoreReady,
    annotationContainerUri,
    toggleAnnotationRetrieval,
    onReceiveAnnotationContainerContent,
  } = props;

  // Individual state hooks for each property
  const [selectorString, setSelectorString] = useState<string>(
    props.selectorString || defaultSelectorString,
  );
  const [selectionArea, setSelectionArea] = useState<string>(
    props.selectionArea || defaultSelectionArea,
  );
  const [scoreComponentLoaded, setScoreComponentLoaded] =
    useState<boolean>(false);
  const [
    annotationContainerContentToRetrieve,
    setAnnotationContainerContentToRetrieve,
  ] = useState<string[]>([]);
  const [vrvOptions, setVrvOptions] = useState<VrvOptions>(
    props.vrvOptions || defaultVrvOptions,
  );
  const [selector, setSelector] = useState<DragSelect | undefined>(undefined);

  const scoreComponent = useRef<any>(null);
  const observerRef = useRef<MutationObserver | null>(null);
  const observerAttachedRef = useRef<boolean>(false);
  const scoreElementRef = useRef<Element | null>(null);

  // Update the scoreElementRef whenever scoreComponent changes
  useEffect(() => {
    console.debug("[selectable-score] ref effect: scoreComponent changed", {
      hasRef: !!scoreComponent.current,
    });
    // Update our non-DOM-provided ref when the Score component is mounted
    if (scoreComponent.current) {
      // eslint-disable-next-line react/no-find-dom-node
      const domNode = ReactDOM.findDOMNode(scoreComponent.current);
      if (domNode && domNode instanceof Element) {
        scoreElementRef.current = domNode;
        console.debug("[selectable-score] ref effect: dom node set", {
          nodeName: domNode.nodeName,
        });
      } else {
        console.debug(
          "[selectable-score] ref effect: dom node not found or not Element",
        );
      }
    }
  }, [scoreComponent.current]);

  const attachObserver = useCallback(() => {
    const target = scoreElementRef.current?.querySelector(".score");
    if (target && observerRef.current) {
      try {
        observerRef.current.observe(target, { childList: true });
        observerAttachedRef.current = true;
        console.debug("[selectable-score] observer attached (attachObserver)");
      } catch (e) {
        console.debug("[selectable-score] observer attach failed", e);
      }
    } else {
      console.debug(
        "[selectable-score] attachObserver: missing target or observer",
        {
          hasTarget: !!target,
          hasObserver: !!observerRef.current,
        },
      );
    }
  }, []);

  // Memoize enableSelector to avoid recreation on every render
  const enableSelector = useCallback(() => {
    console.debug("[selectable-score] enableSelector: start", {
      hasSVG: !!score.SVG,
      svgKeys: score.SVG ? Object.keys(score.SVG).length : 0,
      selectorString,
      selectionArea,
    });
    // Check if score.SVG is defined and has keys
    if (!score.SVG || !Object.keys(score.SVG).length) {
      console.log("Enable selector called before MEI has loaded!");
      return; // no MEI loaded yet
    }

    if (selector) {
      try {
        selector.stop();
        console.debug(
          "[selectable-score] enableSelector: previous selector stopped",
        );
      } catch (e) {
        // ignore errors during teardown
        console.debug(
          "[selectable-score] enableSelector: error stopping previous selector",
          e,
        );
      }
    }

    let newSelector: DragSelect | undefined;
    const areaEl = document.querySelector(selectionArea) as HTMLElement | null;
    const selectables = Array.from(
      document.querySelectorAll(selectorString),
    ) as any;
    console.debug("[selectable-score] enableSelector: resolved DOM", {
      hasArea: !!areaEl,
      selectablesCount: selectables ? selectables.length : 0,
    });
    if (selectorString.length && areaEl && selectables.length > 0) {
      newSelector = new DragSelect({
        selectables,
        area: areaEl,
        selectedClass: "selected",
        onDragStartBegin: () => {
          document.body.classList.add("s-noselect");
        },
        callback: (elements: Element[]) => {
          document.body.classList.remove("s-noselect");
          if (onSelectionChange) {
            onSelectionChange(elements);
          }
        },
      } as any);
      console.debug(
        "[selectable-score] enableSelector: new DragSelect created",
      );
    } else {
      console.debug(
        "[selectable-score] enableSelector: skipped creation due to missing area/selectables",
      );
    }

    // undefined if no selector string specified, otherwise a new DragSelect
    setSelector(newSelector);
  }, [score.SVG, selector, selectorString, selectionArea, onSelectionChange]);

  // Create memoized callbacks to avoid unnecessary re-renders
  const handleScoreUpdate = useCallback(() => {
    console.log("selectable-score: handleScoreUpdate");
    enableSelector();
    if (typeof onScoreUpdate === "function") {
      // eslint-disable-next-line react/no-find-dom-node
      const domNode = scoreComponent.current
        ? ReactDOM.findDOMNode(scoreComponent.current)
        : null;
      const svg =
        domNode instanceof Element ? domNode.querySelector("svg") : null;
      console.debug("[selectable-score] handleScoreUpdate: svg resolved", {
        hasDomNode: !!domNode,
        hasSvg: svg instanceof SVGElement,
      });
      if (svg instanceof SVGElement) onScoreUpdate(svg);
    }
  }, [onScoreUpdate, enableSelector]);

  // Set up the observer on component mount
  useEffect(() => {
    console.debug("[selectable-score] mount: setting up MutationObserver");
    observerRef.current = new MutationObserver(handleScoreUpdate);
    observerAttachedRef.current = false;
    attachObserver();

    return () => {
      // Clean up the observer on unmount
      console.debug(
        "[selectable-score] unmount: cleaning up observer and selector",
      );
      if (observerRef.current) {
        observerRef.current.disconnect();
        console.debug("[selectable-score] unmount: observer disconnected");
      }
      observerAttachedRef.current = false;

      // Stop any active selector
      if (selector) {
        try {
          selector.stop();
          console.debug("[selectable-score] unmount: selector stopped");
        } catch (e) {
          // ignore errors during teardown
          console.debug(
            "[selectable-score] unmount: error stopping selector",
            e,
          );
        }
      }
    };
  }, [handleScoreUpdate, selector, attachObserver]);

  const fetchAnnotationContainer = useCallback(() => {
    if (!annotationContainerUri) return;

    console.debug("[selectable-score] fetchAnnotationContainer: start", {
      annotationContainerUri,
    });
    fetch(annotationContainerUri, {
      mode: "cors",
      headers: { Accept: "application/ld+json" },
    })
      .then((response) => response.json())
      .then((data) => {
        // fetch any contents of the container
        let uri = annotationContainerUri;
        // ensure uri ends with slash
        uri = uri.charAt(uri.length - 1) === "/" ? uri : uri + "/";
        // find json-ld description of the container itself
        const container = data.filter((x: any) => x["@id"] === uri)[0];
        if (CONTAINS in container) {
          const contentUris = container[CONTAINS].map(
            (contentItem: any) => contentItem["@id"],
          ).filter((uri: string) => !uri.endsWith(".lock/")); // skip SOLID lock files

          setAnnotationContainerContentToRetrieve(contentUris);
          fetchAnnotationContainerContent(contentUris);
          console.debug(
            "[selectable-score] fetchAnnotationContainer: contains",
            {
              count: contentUris.length,
            },
          );
        } else {
          if (onReceiveAnnotationContainerContent) {
            onReceiveAnnotationContainerContent({});
          }
          console.debug(
            "[selectable-score] fetchAnnotationContainer: no contents in container",
          );
        }
      })
      .catch((err) => console.log("Error: ", err));
  }, [annotationContainerUri, onReceiveAnnotationContainerContent]);

  const fetchAnnotationContainerContent = useCallback(
    (contentUris: string[] = annotationContainerContentToRetrieve) => {
      console.debug(
        "[selectable-score] fetchAnnotationContainerContent: start",
        {
          count: contentUris.length,
        },
      );
      Promise.all(
        contentUris.map((uri) =>
          fetch(uri, {
            mode: "cors",
            headers: { Accept: "application/ld+json" },
          }),
        ),
      )
        .then((responses) => {
          Promise.all(
            responses
              .map((response) => {
                try {
                  return response.json();
                } catch (e) {
                  console.error("Couldn't read annotation response json: ", e);
                  return null;
                }
              })
              .filter((json) => !!json),
          )
            .then((content) => {
              // inject content URIs into JSON-LD objects
              content.forEach((c: any, ix: number) => {
                c["@id"] = contentUris[ix];
              });
              // and callback to the application
              if (onReceiveAnnotationContainerContent) {
                onReceiveAnnotationContainerContent(content);
              }
              console.debug(
                "[selectable-score] fetchAnnotationContainerContent: delivered",
                {
                  delivered: content.length,
                },
              );
            })
            .catch((err) =>
              console.error("Error extracting response json: ", err),
            );
        })
        .catch((err) => console.log("Error retrieving content: ", err));
    },
    [onReceiveAnnotationContainerContent, annotationContainerContentToRetrieve],
  );

  // ComponentDidMount equivalent
  useEffect(() => {
    console.debug("[selectable-score] effect: componentDidMount equivalent", {
      hasAnnotationContainerUri: !!annotationContainerUri,
      toggleAnnotationRetrieval,
      hasOnReceive: !!onReceiveAnnotationContainerContent,
    });
    // handle fetching of annotation container contents
    if (annotationContainerUri && toggleAnnotationRetrieval) {
      if (onReceiveAnnotationContainerContent) {
        fetchAnnotationContainer();
      } else {
        console.error(
          "Specified annotation container URI without onReceiveAnnotationContainerContent callback",
        );
      }
    }
  }, [
    annotationContainerUri,
    toggleAnnotationRetrieval,
    onReceiveAnnotationContainerContent,
    fetchAnnotationContainer,
  ]);

  // Handle changes to toggleAnnotationRetrieval
  useEffect(() => {
    if (annotationContainerUri && toggleAnnotationRetrieval) {
      if (onReceiveAnnotationContainerContent) {
        // update annotation container flag toggled on, clear state and refetch
        setAnnotationContainerContentToRetrieve([]);
        fetchAnnotationContainer();
        console.debug(
          "[selectable-score] effect: toggleAnnotationRetrieval -> refetched",
        );
      } else {
        console.error(
          "Specified annotation container URI without onReceiveAnnotationContainerContent callback",
        );
      }
    }
  }, [
    toggleAnnotationRetrieval,
    annotationContainerUri,
    onReceiveAnnotationContainerContent,
    fetchAnnotationContainer,
  ]);

  // Handle score component loading
  useEffect(() => {
    console.debug("[selectable-score] effect: score component loading check", {
      scoreComponentLoaded,
      hasScoreElementRef: !!scoreElementRef.current,
    });
    if (!scoreComponentLoaded && scoreElementRef.current) {
      const svgElement = scoreElementRef.current.querySelector("svg");
      if (svgElement) {
        setScoreComponentLoaded(true);
        console.debug(
          "[selectable-score] effect: svg found, marking loaded and invoking onScoreReady",
        );

        if (typeof onScoreReady === "function" && score.vrvTk) {
          onScoreReady(svgElement as SVGElement, score.vrvTk);
        }

        attachObserver();

        enableSelector();
      }
    }
  }, [
    scoreComponentLoaded,
    score.vrvTk,
    onScoreReady,
    enableSelector,
    attachObserver,
  ]);

  // Handle selector string changes
  useEffect(() => {
    if (props.selectorString && props.selectorString !== selectorString) {
      console.debug("[selectable-score] effect: selectorString changed", {
        from: selectorString,
        to: props.selectorString,
      });
      setSelectorString(props.selectorString || defaultSelectorString);
      enableSelector();
    }
  }, [props.selectorString, selectorString, enableSelector]);

  // Handle selection area changes
  useEffect(() => {
    if (props.selectionArea && props.selectionArea !== selectionArea) {
      console.debug("[selectable-score] effect: selectionArea changed", {
        from: selectionArea,
        to: props.selectionArea,
      });
      setSelectionArea(props.selectionArea);
    }
  }, [props.selectionArea, selectionArea]);

  // Handle vrvOptions changes
  useEffect(() => {
    if (
      props.vrvOptions &&
      JSON.stringify(vrvOptions) !== JSON.stringify(props.vrvOptions)
    ) {
      console.log("Options have changed, updating score");
      console.debug("[selectable-score] effect: vrvOptions changed", {
        from: vrvOptions,
        to: props.vrvOptions,
      });
      setVrvOptions(props.vrvOptions || defaultVrvOptions);
      scoreSetOptions(uri, props.vrvOptions);
      // Ensure observer is attached and trigger one update so parents get notified
      attachObserver();
      handleScoreUpdate();
    }
  }, [
    props.vrvOptions,
    vrvOptions,
    uri,
    scoreSetOptions,
    attachObserver,
    handleScoreUpdate,
  ]);

  console.log("Attempting to render score with uri: ", uri);

  return (
    <Score uri={uri} key={uri} options={vrvOptions} ref={scoreComponent} />
  );
};

const mapStateToProps = (state: ScoreState) => ({
  score: state.score,
});

const mapDispatchToProps = (dispatch: Dispatch) =>
  bindActionCreators({ scoreSetOptions }, dispatch);

export default connect(mapStateToProps, mapDispatchToProps)(SelectableScore);
