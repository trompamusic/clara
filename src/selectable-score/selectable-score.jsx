import React, { Component } from "react";
import { connect } from "react-redux";
import { bindActionCreators } from "redux";
import Score from "meld-clients-core/lib/containers/score";
import { scoreSetOptions } from "meld-clients-core/lib/actions/index";

import DragSelect from "dragselect/dist/DragSelect";
import ReactDOM from "react-dom";
import { fetch } from "@inrupt/solid-client-authn-browser";

const CONTAINS = "http://www.w3.org/ns/ldp#contains";

const defaultVrvOptions = {
  scale: 45,
  adjustPageHeight: 1,
  pageHeight: 2500,
  pageWidth: 2200,
  footer: "none",
  unit: 6,
};

const defaultSelectorString = ".note";
const defaultSelectionArea = ".score";

class SelectableScore extends Component {
  constructor(props) {
    super(props);
    this.state = {
      selectorString:
        "selectorString" in this.props
          ? this.props.selectorString
          : defaultSelectorString,
      selectionArea:
        "selectionArea" in this.props
          ? this.props.selectionArea
          : defaultSelectionArea,
      scoreComponentLoaded: false,
      annotationContainerContentToRetrieve: [],
      vrvOptions:
        "vrvOptions" in this.props ? this.props.vrvOptions : defaultVrvOptions,
    };
    // Store selector as instance property rather than state to avoid unnecessary re-renders
    this.selector = undefined;
    // Guard flag to prevent re-entrant score updates within the same animation frame
    this.pendingScoreUpdate = false;
    this.enableSelector = this.enableSelector.bind(this);
    this.scoreComponent = React.createRef();
    this.handleScoreUpdate = this.handleScoreUpdate.bind(this);
    // Debounce observer callback to batch rapid DOM mutations from Verovio rendering
    this.handleScoreUpdateDebounced = this.debounce(this.handleScoreUpdate, 50);
    this.observer = new MutationObserver(this.handleScoreUpdateDebounced);
  }

  // Debounce helper to batch rapid mutations during Verovio SVG rendering
  debounce(func, wait) {
    return (...args) => {
      const later = () => {
        clearTimeout(this.scoreUpdateTimeout);
        func.apply(this, args);
      };
      clearTimeout(this.scoreUpdateTimeout);
      this.scoreUpdateTimeout = setTimeout(later, wait);
    };
  }

  handleScoreUpdate() {
    if (this.unmounted || this.pendingScoreUpdate) return;
    this.pendingScoreUpdate = true;
    this.scoreUpdateFrame = requestAnimationFrame(() => {
      this.pendingScoreUpdate = false;
      if (this.unmounted) return;
      this.enableSelector();
      this.publishScorePage();
    });
  }

  // Called after React has committed the MELD Score child. The observer is a
  // fallback notification, never a source of renderer provenance.
  publishScorePage = () => {
    const { score, uri } = this.props;
    const page = score.pageState[uri]?.currentPage;
    const entry = score.SVG[uri]?.[page];
    const svg =
      this.scoreComponent.current &&
      ReactDOM.findDOMNode(this.scoreComponent.current).querySelector(
        ".score > svg",
      );
    if (
      !svg ||
      !svg.isConnected ||
      !entry ||
      score.currentlyLoadedIntoVrv !== uri
    ) {
      if (this.publishedSvg) {
        this.publishedSvg = null;
        this.publishedEntry = null;
        this.props.onScoreUnavailable?.(uri);
      }
      return;
    }
    if (this.publishedSvg === svg && this.publishedEntry === entry) return;
    // A fresh score load replaces the page cache. Page navigation keeps the
    // previous page entries; reuse score-wide metadata only in that case.
    const cache = score.SVG[uri];
    const sharesPage =
      this.metadataCache &&
      Object.keys(cache).some(
        (key) => cache[key] === this.metadataCache.pages[key],
      );
    if (
      !this.metadataCache ||
      this.metadataCache.uri !== uri ||
      this.metadataCache.sourceMei !== score.MEI[uri] ||
      !sharesPage
    ) {
      this.metadataCache = {
        uri,
        sourceMei: score.MEI[uri],
        mei: score.vrvTk.getMEI(),
        timemap: score.vrvTk.renderToTimemap(),
        pages: cache,
      };
    } else {
      this.metadataCache.pages = cache;
    }
    this.publishedSvg = svg;
    this.publishedEntry = entry;
    this.props.onScoreUpdate?.(svg, {
      uri,
      page,
      appliedOptions: { ...entry.options },
      mei: this.metadataCache.mei,
      timemap: this.metadataCache.timemap,
    });
  };

  enableSelector() {
    if (!Object.keys(this.props.score.SVG).length) {
      console.log("Enable selector called before MEI has loaded!");
      return; // no MEI loaded yet
    }
    if (typeof this.selector !== "undefined") {
      this.selector.stop();
    }
    let selector;
    if (this.state.selectorString.length) {
      selector = new DragSelect({
        selectables: document.querySelectorAll(this.state.selectorString),
        area: document.querySelector(this.state.selectionArea),
        selectedClass: "selected",
        onDragStartBegin: () => {
          document.body.classList.add("s-noselect");
        },
        callback: (elements) => {
          document.body.classList.remove("s-noselect");
          this.props.onSelectionChange(elements);
        },
      });
    }
    // Store selector as instance property (not state) to avoid triggering re-render
    this.selector = selector;
  }

  fetchAnnotationContainer() {
    fetch(this.props.annotationContainerUri, {
      mode: "cors",
      headers: { Accept: "application/ld+json" },
    })
      .then((response) => response.json())
      .then((data) => {
        // fetch any contents of the container
        let uri = this.props.annotationContainerUri;
        // ensure uri ends with slash
        uri = uri.charAt(uri.length - 1) === "/" ? uri : uri + "/";
        // find json-ld description of the container itself
        const container = data.filter((x) => x["@id"] === uri)[0];
        if (CONTAINS in container) {
          const contentUris = container[CONTAINS].map(
            (contentItem) => contentItem["@id"],
          ).filter((uri) => !uri.endsWith(".lock/")); // skip SOLID lock files
          this.setState(
            { annotationContainerContentToRetrieve: contentUris },
            () => {
              this.fetchAnnotationContainerContent();
            },
          );
        } else {
          this.props.onReceiveAnnotationContainerContent({});
        } // report empty container
      })
      .catch((err) => console.log("Error: ", err));
  }

  fetchAnnotationContainerContent() {
    Promise.all(
      this.state.annotationContainerContentToRetrieve.map((uri) =>
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
            content.forEach((c, ix) => {
              c["@id"] = this.state.annotationContainerContentToRetrieve[ix];
            });
            // and callback to the application
            this.props.onReceiveAnnotationContainerContent(content);
          })
          .catch((err) =>
            console.error("Error extracting response json: ", err),
          );
      })
      .catch((err) => console.log("Error retrieving content: ", err));
  }

  componentDidMount() {
    // handle fetching of annotation container contents
    if (
      this.props.annotationContainerUri &&
      this.props.toggleAnnotationRetrieval
    ) {
      if (this.props.onReceiveAnnotationContainerContent) {
        this.fetchAnnotationContainer();
      } else {
        console.error(
          "Specified annotation container URI without onReceiveAnnotationContainerContent callback",
        );
      }
    }
  }

  componentWillUnmount() {
    // Clean up DragSelect instance and MutationObserver to prevent memory leaks
    if (typeof this.selector !== "undefined") {
      this.selector.stop();
    }
    this.unmounted = true;
    clearTimeout(this.scoreUpdateTimeout);
    cancelAnimationFrame(this.scoreUpdateFrame);
    this.observer.disconnect();
  }

  componentDidUpdate(prevProps, prevState) {
    this.publishScorePage();
    if (
      this.props.annotationContainerUri &&
      !prevProps.toggleAnnotationRetrieval &&
      this.props.toggleAnnotationRetrieval
    ) {
      if (this.props.onReceiveAnnotationContainerContent) {
        // update annotation container flag toggled on, clear state and refetch
        this.setState(
          {
            annotationContainerContentToRetrieve: [],
          },
          this.fetchAnnotationContainer(),
        );
      } else {
        console.error(
          "Specified annotation container URI without onReceiveAnnotationContainerContent callback",
        );
      }
    }

    if (!prevState.scoreComponentLoaded && this.scoreComponent.current) {
      // first load of score component - run onScoreReady callback if provided, and start observing for DOM changes
      const svgElement = ReactDOM.findDOMNode(
        this.scoreComponent.current,
      ).querySelector("svg");
      if (svgElement) {
        this.setState({ scoreComponentLoaded: true }, () => {
          typeof this.props.onScoreReady === "function" &&
            this.props.onScoreReady(svgElement, this.props.score.vrvTk);
          this.observer.observe(
            ReactDOM.findDOMNode(this.scoreComponent.current).querySelector(
              ".score",
            ),
            { childList: true },
          );
          this.enableSelector();
        });
      }
    }
    if (prevProps.selectorString !== this.props.selectorString) {
      // selector changed (e.g. from .note to .measure), re-initialise selectors
      this.setState({ selectorString: this.props.selectorString }, () =>
        this.enableSelector(),
      );
    }
    if (
      "vrvOptions" in this.props &&
      JSON.stringify(prevState.vrvOptions) !==
        JSON.stringify(this.props.vrvOptions)
    ) {
      // options have changed
      console.log("Options have changed, updating score");
      console.log(this.props.vrvOptions);
      this.setState({ vrvOptions: this.props.vrvOptions }, () =>
        this.props.scoreSetOptions(this.props.uri, this.state.vrvOptions),
      );
    }
  }

  render() {
    console.log("cAttempting to render score with uri: ", this.props.uri);
    return (
      <Score
        uri={this.props.uri}
        key={this.props.uri}
        options={this.state.vrvOptions}
        ref={this.scoreComponent}
      />
    );
  }
}

function mapStateToProps({ score }) {
  return { score };
}

function mapDispatchToProps(dispatch) {
  return bindActionCreators(
    {
      scoreSetOptions,
    },
    dispatch,
  );
}

export default connect(mapStateToProps, mapDispatchToProps)(SelectableScore);
