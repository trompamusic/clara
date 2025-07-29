import React, { useState, useEffect, useRef } from 'react';
import { useLdo, useResource, useSolidAuth } from '@ldo/solid-react';
import { ContainerUri } from '@ldo/solid';
import { CLARA_CONTAINER_NAME } from '../config';

export function useInterval(callback: () => any, delay: number) {
    const savedCallback = useRef();

    // Remember the latest callback.
    useEffect(() => {
        // @ts-ignore
        savedCallback.current = callback;
    }, [callback]);

    // Set up the interval.
    useEffect(() => {
        function tick() {
            // @ts-ignore
            savedCallback.current();
        }
        if (delay !== null) {
            let id = setInterval(tick, delay);
            return () => clearInterval(id);
        }
    }, [delay]);
}

/**
 * Hook to get the user's main storage container and list its contents
 * Uses LDO solid-react hooks instead of inrupt/solid-client
 */
export function useMainContainer() {
    const { session } = useSolidAuth();
    const { getResource } = useLdo();
    const [mainContainerUri, setMainContainerUri] = useState<ContainerUri | undefined>();
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!session.webId) {
            setIsLoading(false);
            return;
        }

        const setupMainContainer = async () => {
            try {
                setIsLoading(true);
                setError(null);
                
                // Get the WebId resource
                const webIdResource = getResource(session.webId!);
                
                // Check if the resource is valid
                if (webIdResource.type === "InvalidIdentifierResouce") {
                    setError("Invalid WebId resource");
                    setIsLoading(false);
                    return;
                }
                
                // Get the root container associated with that WebId
                const rootContainerResult = await webIdResource.getRootContainer();
                
                if (rootContainerResult.isError) {
                    setError(`Failed to get root container: ${rootContainerResult.message}`);
                    setIsLoading(false);
                    return;
                }
                
                setMainContainerUri(rootContainerResult.uri);
                setIsLoading(false);
            } catch (err) {
                setError(`Error setting up main container: ${err instanceof Error ? err.message : 'Unknown error'}`);
                setIsLoading(false);
            }
        };

        setupMainContainer();
    }, [session.webId, getResource]);

    // Use the main container URI to get the resource
    const mainContainer = useResource(mainContainerUri);

    return {
        mainContainer,
        mainContainerUri,
        isLoading,
        error,
        children: mainContainer && mainContainer.type === "SolidContainer" ? mainContainer.children() : []
    };
}

/**
 * Hook specifically for working with the CLARA container
 * Wraps useMainContainer and provides CLARA-specific functionality
 */
export function useClaraContainer() {
    const { mainContainer, mainContainerUri, isLoading, error } = useMainContainer();
    const { getResource } = useLdo();
    const [claraContainerUri, setClaraContainerUri] = useState<ContainerUri | undefined>();
    const [isClaraLoading, setIsClaraLoading] = useState(true);
    const [claraError, setClaraError] = useState<string | null>(null);

    useEffect(() => {
        if (!mainContainerUri || isLoading) {
            return;
        }

        const setupClaraContainer = async () => {
            try {
                setIsClaraLoading(true);
                setClaraError(null);

                // Get the main container resource
                const mainContainerResource = getResource(mainContainerUri);
                
                // Check if the resource is a container
                if (mainContainerResource.type !== "SolidContainer") {
                    setClaraError("Main container is not a valid container");
                    setIsClaraLoading(false);
                    return;
                }
                
                // Get the CLARA container as a child of the main container
                const claraContainer = mainContainerResource.child(CLARA_CONTAINER_NAME);
                setClaraContainerUri(claraContainer.uri);
                
                // Create the CLARA container if it doesn't exist
                await claraContainer.createIfAbsent();
                
                setIsClaraLoading(false);
            } catch (err) {
                setClaraError(`Error setting up CLARA container: ${err instanceof Error ? err.message : 'Unknown error'}`);
                setIsClaraLoading(false);
            }
        };

        setupClaraContainer();
    }, [mainContainerUri, isLoading, getResource]);

    // Use the CLARA container URI to get the resource
    const claraContainer = useResource(claraContainerUri);

    return {
        claraContainer,
        claraContainerUri,
        isLoading: isLoading || isClaraLoading,
        error: error || claraError,
        children: claraContainer && claraContainer.type === "SolidContainer" ? claraContainer.children() : []
    };
}
