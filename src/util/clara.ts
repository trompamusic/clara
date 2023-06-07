import {getSolidDataset, getThing, getUrl, getUrlAll} from "@inrupt/solid-client";
import {WS} from "@inrupt/vocab-solid-common";
import {CLARA_CONTAINER_NAME} from "../config";
import {LDP, SKOS} from "@inrupt/lit-generated-vocab-common";


export const getStorageForUser = async (webId: string, fetch: any): Promise<string|null> => {
    console.log(`Getting storage for user ${webId}`);
    const dataset = await getSolidDataset(webId, { fetch });
    const profileDoc = getThing(dataset, webId);
    return getUrl(profileDoc!, WS.storage);
}

export const getScoresForUser = async (webId: string, fetch: any): Promise<string[]> => {
    const storageUrl = await getStorageForUser(webId, fetch);
    const claraScoreContainerUrl = storageUrl + CLARA_CONTAINER_NAME + "scores/";
    return getSolidDataset(claraScoreContainerUrl, { fetch }).then(performanceDataset => {
        const performanceDoc = getThing(performanceDataset, claraScoreContainerUrl);
        return getUrlAll(performanceDoc!, LDP.contains);
    }).catch(() => {
        return [];
    })
}

export const getScoreDocument = async (url: string, fetch: any) => {
    const dataset = await getSolidDataset(url, { fetch });
    return getThing(dataset, url);
}

export const getPerformanceFromScore = async (score: any, fetch: any) => {
    console.log(`Getting performance from score ${score}`);
    const scoreDocument = await getScoreDocument(score, fetch);
    console.log(scoreDocument);
    const documentUri = getUrl(scoreDocument!, SKOS.related);
    console.log(`Document URI: ${documentUri}`);
    return documentUri;
}

