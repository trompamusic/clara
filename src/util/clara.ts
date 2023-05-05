import {getSolidDataset, getThing, getUrl, getUrlAll} from "@inrupt/solid-client";
import {WS} from "@inrupt/vocab-solid-common";
import {CLARA_CONTAINER_NAME} from "../config";
import {LDP} from "@inrupt/lit-generated-vocab-common";


export const getScoresForUser = async (webId: string, fetch: any): Promise<string[]> => {
    const dataset = await getSolidDataset(webId, { fetch });
    const profileDoc = getThing(dataset, webId);
    const storageUrl = getUrl(profileDoc, WS.storage);
    const claraScoreContainerUrl = storageUrl + CLARA_CONTAINER_NAME + "scores/";
    const performanceDataset = await getSolidDataset(claraScoreContainerUrl, { fetch });
    const performanceDoc = getThing(performanceDataset, claraScoreContainerUrl);
    return getUrlAll(performanceDoc, LDP.contains);
}

export const getScoreDocument = async (url: string, fetch: any) => {
    const dataset = await getSolidDataset(url, { fetch });
    return getThing(dataset, url);
}

