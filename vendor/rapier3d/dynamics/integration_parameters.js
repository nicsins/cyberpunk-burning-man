import { RawIntegrationParameters } from "../raw.js";
import { SoftRecoverySettings } from "./soft_body.js";
export class IntegrationParameters {
    constructor(raw) {
        this.raw = raw || new RawIntegrationParameters();
    }
    /**
     * Free the WASM memory used by these integration parameters.
     */
    free() {
        if (!!this.raw) {
            this.raw.free();
        }
        this.raw = undefined;
    }
    /**
     * The timestep length (default: `1.0 / 60.0`)
     */
    get dt() {
        return this.raw.dt;
    }
    /**
     * The Error Reduction Parameter in `[0, 1]` is the proportion of
     * the positional error to be corrected at each time step (default: `0.2`).
     */
    get contact_erp() {
        return this.raw.contact_erp;
    }
    get lengthUnit() {
        return this.raw.lengthUnit;
    }
    /**
     * Normalized amount of penetration the engine won’t attempt to correct (default: `0.001m`).
     *
     * This threshold considered by the physics engine is this value multiplied by the `lengthUnit`.
     */
    get normalizedAllowedLinearError() {
        return this.raw.normalizedAllowedLinearError;
    }
    /**
     * The maximal normalized distance separating two objects that will generate predictive contacts (default: `0.02`).
     *
     * This threshold considered by the physics engine is this value multiplied by the `lengthUnit`.
     */
    get normalizedPredictionDistance() {
        return this.raw.normalizedPredictionDistance;
    }
    /**
     * The number of solver iterations run by the constraints solver for calculating forces (default: `4`).
     */
    get numSolverIterations() {
        return this.raw.numSolverIterations;
    }
    /**
     * Number of internal Project Gauss Seidel (PGS) iterations run at each solver iteration (default: `1`).
     */
    get numInternalPgsIterations() {
        return this.raw.numInternalPgsIterations;
    }
    /**
     * Maximum number of substeps performed by the  solver (default: `1`).
     */
    get maxCcdSubsteps() {
        return this.raw.maxCcdSubsteps;
    }
    /**
     * Strain beyond which a soft-body constraint is re-solved after the contacts inside every
     * substep, so a light body buried under heavier ones is not torn (default: `0.75`).
     */
    get softBodiesResweepStrain() {
        return this.raw.softBodiesResweepStrain;
    }
    /**
     * Maximum number of extra substeps a soft body requests for its island while it is hit
     * fast (default: `4`; `0` disables the impact-adaptive substeps).
     */
    get softBodiesMaxExtraSubsteps() {
        return this.raw.softBodiesMaxExtraSubsteps;
    }
    /**
     * Factor applied to the contact softness natural frequencies for the soft-body contacts
     * (default: `4.0`).
     */
    get softBodiesContactStiffening() {
        return this.raw.softBodiesContactStiffening;
    }
    /**
     * The tangle detection and recovery settings shared by every soft body of the world.
     *
     * This gives back a copy: change it and assign it back to apply it.
     */
    get softBodiesRecovery() {
        return SoftRecoverySettings.fromRaw(this.raw.softBodiesRecovery);
    }
    /**
     * Relative residual at which the conjugate gradient of the FEM soft-body solver stops
     * (default: `1.0e-5`).
     */
    get softBodiesFemLinearTolerance() {
        return this.raw.softBodiesFemLinearTolerance;
    }
    /**
     * Hard cap on the conjugate-gradient iterations of the FEM soft-body solver, whatever the
     * residual (default: `20`).
     */
    get softBodiesFemMaxLinearIterations() {
        return this.raw.softBodiesFemMaxLinearIterations;
    }
    /**
     * Largest number of degrees of freedom for which a FEM soft body is factorized directly
     * (default: `600`); the larger ones rely on the conjugate gradient.
     */
    get softBodiesFemMaxDenseDofs() {
        return this.raw.softBodiesFemMaxDenseDofs;
    }
    set dt(value) {
        this.raw.dt = value;
    }
    set softBodiesResweepStrain(value) {
        this.raw.softBodiesResweepStrain = value;
    }
    set softBodiesMaxExtraSubsteps(value) {
        this.raw.softBodiesMaxExtraSubsteps = value;
    }
    set softBodiesContactStiffening(value) {
        this.raw.softBodiesContactStiffening = value;
    }
    set softBodiesRecovery(value) {
        let raw = value.intoRaw();
        this.raw.softBodiesRecovery = raw;
        raw.free();
    }
    set softBodiesFemLinearTolerance(value) {
        this.raw.softBodiesFemLinearTolerance = value;
    }
    set softBodiesFemMaxLinearIterations(value) {
        this.raw.softBodiesFemMaxLinearIterations = value;
    }
    set softBodiesFemMaxDenseDofs(value) {
        this.raw.softBodiesFemMaxDenseDofs = value;
    }
    set contact_natural_frequency(value) {
        this.raw.contact_natural_frequency = value;
    }
    set lengthUnit(value) {
        this.raw.lengthUnit = value;
    }
    set normalizedAllowedLinearError(value) {
        this.raw.normalizedAllowedLinearError = value;
    }
    set normalizedPredictionDistance(value) {
        this.raw.normalizedPredictionDistance = value;
    }
    /**
     * Sets the number of solver iterations run by the constraints solver for calculating forces (default: `4`).
     */
    set numSolverIterations(value) {
        this.raw.numSolverIterations = value;
    }
    /**
     * Sets the number of internal Project Gauss Seidel (PGS) iterations run at each solver iteration (default: `1`).
     */
    set numInternalPgsIterations(value) {
        this.raw.numInternalPgsIterations = value;
    }
    set maxCcdSubsteps(value) {
        this.raw.maxCcdSubsteps = value;
    }
}
//# sourceMappingURL=integration_parameters.js.map