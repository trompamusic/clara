import { LdoJsonldContext, LdSet } from "@ldo/ldo";

/**
 * =============================================================================
 * Typescript Typings for container
 * =============================================================================
 */

/**
 * ContainerShape Type
 */
export interface ContainerShape {
  "@id"?: string;
  "@context"?: LdoJsonldContext;
  /**
   * Defines the node as an LDP Container
   */
  type?: LdSet<
    | {
        "@id": "Container";
      }
    | {
        "@id": "BasicContainer";
      }
    | {
        "@id": "Resource";
      }
  >;
  /**
   * The last modification date of the container
   */
  modified?: string;
  /**
   * A list of resources contained within this container
   */
  contains?: LdSet<{
    "@id": string;
  }>;
  /**
   * POSIX modification time as Unix timestamp
   */
  mtime?: number;
}

/**
 * ResourceShape Type
 */
export interface ResourceShape {
  "@id"?: string;
  "@context"?: LdoJsonldContext;
  /**
   * Defines the node as an LDP Resource
   */
  type?: LdSet<{
    "@id": "Resource";
  }>;
  /**
   * The last modification date of the resource
   */
  modified?: string;
  /**
   * POSIX modification time as Unix timestamp
   */
  mtime?: number;
  /**
   * Size of the resource in bytes
   */
  size?: number;
}
