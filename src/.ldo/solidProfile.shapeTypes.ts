import { ShapeType } from "@ldo/ldo";
import { solidProfileSchema } from "./solidProfile.schema";
import { solidProfileContext } from "./solidProfile.context";
import {
  SolidProfile,
  Address,
  Email,
  PhoneNumber,
  TrustedApp,
  RSAPublicKey,
} from "./solidProfile.typings";

/**
 * =============================================================================
 * LDO ShapeTypes solidProfile
 * =============================================================================
 */

/**
 * SolidProfile ShapeType
 */
export const SolidProfileShapeType: ShapeType<SolidProfile> = {
  schema: solidProfileSchema,
  shape: "https://shaperepo.com/schemas/solidProfile#SolidProfileShape",
  context: solidProfileContext,
};

/**
 * Address ShapeType
 */
export const AddressShapeType: ShapeType<Address> = {
  schema: solidProfileSchema,
  shape: "https://shaperepo.com/schemas/solidProfile#AddressShape",
  context: solidProfileContext,
};

/**
 * Email ShapeType
 */
export const EmailShapeType: ShapeType<Email> = {
  schema: solidProfileSchema,
  shape: "https://shaperepo.com/schemas/solidProfile#EmailShape",
  context: solidProfileContext,
};

/**
 * PhoneNumber ShapeType
 */
export const PhoneNumberShapeType: ShapeType<PhoneNumber> = {
  schema: solidProfileSchema,
  shape: "https://shaperepo.com/schemas/solidProfile#PhoneNumberShape",
  context: solidProfileContext,
};

/**
 * TrustedApp ShapeType
 */
export const TrustedAppShapeType: ShapeType<TrustedApp> = {
  schema: solidProfileSchema,
  shape: "https://shaperepo.com/schemas/solidProfile#TrustedAppShape",
  context: solidProfileContext,
};

/**
 * RSAPublicKey ShapeType
 */
export const RSAPublicKeyShapeType: ShapeType<RSAPublicKey> = {
  schema: solidProfileSchema,
  shape: "https://shaperepo.com/schemas/solidProfile#RSAPublicKeyShape",
  context: solidProfileContext,
};
