import { RawSoftBodyBuilder, RawSoftBodyMaterial, RawSoftRecoverySettings, } from "../raw.js";
import { RotationOps, VectorOps, scratchBuffer } from "../math.js";
import { ColliderDesc } from "../geometry/index.js";
/**
 * The constitutive model of a soft body's cells (triangles in 2D, tetrahedra in 3D).
 */
export var SoftBodyCellModel;
(function (SoftBodyCellModel) {
    /**
     * Per-cell area/volume preservation constraints (the cell's shape is held by its edges).
     */
    SoftBodyCellModel[SoftBodyCellModel["Volume"] = 0] = "Volume";
    /**
     * Corotational linear elasticity: a linear material in the cell's rotated frame.
     */
    SoftBodyCellModel[SoftBodyCellModel["Corotational"] = 1] = "Corotational";
    /**
     * Neo-Hookean hyperelasticity, which resists inversion and large compressions.
     */
    SoftBodyCellModel[SoftBodyCellModel["NeoHookean"] = 2] = "NeoHookean";
})(SoftBodyCellModel || (SoftBodyCellModel = {}));
/**
 * Which strains make a soft body's edge rest lengths flow plastically.
 */
export var SoftEdgePlasticFlow;
(function (SoftEdgePlasticFlow) {
    SoftEdgePlasticFlow[SoftEdgePlasticFlow["Both"] = 0] = "Both";
    SoftEdgePlasticFlow[SoftEdgePlasticFlow["Compression"] = 1] = "Compression";
    SoftEdgePlasticFlow[SoftEdgePlasticFlow["Tension"] = 2] = "Tension";
})(SoftEdgePlasticFlow || (SoftEdgePlasticFlow = {}));
/**
 * Which solver holds the cells of a soft body together.
 */
export var SoftBodySolver;
(function (SoftBodySolver) {
    /**
     * Every element of the lattice becomes a constraint, solved with the contacts and the
     * joints of the scene.
     */
    SoftBodySolver[SoftBodySolver["Constraints"] = 0] = "Constraints";
    /**
     * The elasticity of the whole body is assembled into one linear system, solved at each
     * substep; the stiffness of the body no longer depends on the iteration count. Needs cells.
     */
    SoftBodySolver[SoftBodySolver["Fem"] = 1] = "Fem";
})(SoftBodySolver || (SoftBodySolver = {}));
/**
 * What the per-point constraints of the features an intersection-volume constraint acts on do.
 */
export var SoftPatchConstraints;
(function (SoftPatchConstraints) {
    /**
     * Keep them as they are (they may fight the volume constraint).
     */
    SoftPatchConstraints[SoftPatchConstraints["Keep"] = 0] = "Keep";
    /**
     * Stand them down: the volume constraint alone acts on those features.
     */
    SoftPatchConstraints[SoftPatchConstraints["StandDown"] = 1] = "StandDown";
    /**
     * Keep them, but along the volume constraint's normal, so they push the way it does.
     */
    SoftPatchConstraints[SoftPatchConstraints["AlongNormal"] = 2] = "AlongNormal";
})(SoftPatchConstraints || (SoftPatchConstraints = {}));
/**
 * The tangle detection and recovery settings shared by every soft body of a world.
 *
 * A plain JavaScript object; read it from `IntegrationParameters.softBodiesRecovery` and
 * assign it back to apply it. Every mechanism switches off individually.
 */
export class SoftRecoverySettings {
    constructor() {
        SoftRecoverySettings.copyFromRaw(this, new RawSoftRecoverySettings(), true);
    }
    /** @internal */
    static fromRaw(raw) {
        let res = new SoftRecoverySettings();
        SoftRecoverySettings.copyFromRaw(res, raw, true);
        return res;
    }
    /** @internal */
    static copyFromRaw(target, raw, freeRaw) {
        target.authoredVelocityMargin = raw.authoredVelocityMargin;
        target.edgeSpeculation = raw.edgeSpeculation;
        target.invertedCellDetection = raw.invertedCellDetection;
        target.selfCrossingDetection = raw.selfCrossingDetection;
        target.detectionMotionGating = raw.detectionMotionGating;
        target.crossBodyDetection = raw.crossBodyDetection;
        target.selfStandDown = raw.selfStandDown;
        target.crossBodyExpelGate = raw.crossBodyExpelGate;
        target.edgeStandDown = raw.edgeStandDown;
        target.crossingRepulsion = raw.crossingRepulsion;
        target.crossingRepulsionGuide = raw.crossingRepulsionGuide;
        target.crossingRepulsionSelfGuide = raw.crossingRepulsionSelfGuide;
        target.overlapConstraints = raw.overlapConstraints;
        target.overlapRigid = raw.overlapRigid;
        target.overlapSkipSelfTangled = raw.overlapSkipSelfTangled;
        target.overlapEdgeStandDown = raw.overlapEdgeStandDown;
        target.overlapSkinVolume = raw.overlapSkinVolume;
        target.overlapSelfRegions = raw.overlapSelfRegions;
        target.overlapNormalPush = raw.overlapNormalPush;
        target.overlapMultiVolume = raw.overlapMultiVolume;
        target.recoveryPace = raw.recoveryPace;
        target.overlapConstraintPace = raw.overlapConstraintPace;
        target.overlapKeptDepth = raw.overlapKeptDepth;
        target.overlapProgressMargin = raw.overlapProgressMargin;
        target.overlapSplit = raw.overlapSplit;
        target.overlapPatience = raw.overlapPatience;
        target.overlapPatchConstraints =
            raw.overlapPatchConstraints;
        if (freeRaw) {
            raw.free();
        }
    }
    /** @internal */
    intoRaw() {
        let raw = new RawSoftRecoverySettings();
        raw.authoredVelocityMargin = this.authoredVelocityMargin;
        raw.edgeSpeculation = this.edgeSpeculation;
        raw.invertedCellDetection = this.invertedCellDetection;
        raw.selfCrossingDetection = this.selfCrossingDetection;
        raw.detectionMotionGating = this.detectionMotionGating;
        raw.crossBodyDetection = this.crossBodyDetection;
        raw.selfStandDown = this.selfStandDown;
        raw.crossBodyExpelGate = this.crossBodyExpelGate;
        raw.edgeStandDown = this.edgeStandDown;
        raw.crossingRepulsion = this.crossingRepulsion;
        raw.crossingRepulsionGuide = this.crossingRepulsionGuide;
        raw.crossingRepulsionSelfGuide = this.crossingRepulsionSelfGuide;
        raw.overlapConstraints = this.overlapConstraints;
        raw.overlapRigid = this.overlapRigid;
        raw.overlapSkipSelfTangled = this.overlapSkipSelfTangled;
        raw.overlapEdgeStandDown = this.overlapEdgeStandDown;
        raw.overlapSkinVolume = this.overlapSkinVolume;
        raw.overlapSelfRegions = this.overlapSelfRegions;
        raw.overlapNormalPush = this.overlapNormalPush;
        raw.overlapMultiVolume = this.overlapMultiVolume;
        raw.recoveryPace = this.recoveryPace;
        raw.overlapConstraintPace = this.overlapConstraintPace;
        raw.overlapKeptDepth = this.overlapKeptDepth;
        raw.overlapProgressMargin = this.overlapProgressMargin;
        raw.overlapSplit = this.overlapSplit;
        raw.overlapPatience = this.overlapPatience;
        raw.overlapPatchConstraints = this
            .overlapPatchConstraints;
        return raw;
    }
}
/**
 * How the vertices of a deformable collider follow the particles of its cluster.
 */
export var SoftMeshBindingMode;
(function (SoftMeshBindingMode) {
    /**
     * Vertex `i` of the mesh follows the `i`-th particle of the binding's particle list.
     */
    SoftMeshBindingMode[SoftMeshBindingMode["Direct"] = 0] = "Direct";
    /**
     * Every vertex follows the particle of the cluster closest to it.
     */
    SoftMeshBindingMode[SoftMeshBindingMode["DirectByPosition"] = 1] = "DirectByPosition";
    /**
     * Every vertex is embedded in the cell of the cluster holding it (cage simulation).
     */
    SoftMeshBindingMode[SoftMeshBindingMode["Skinned"] = 2] = "Skinned";
})(SoftMeshBindingMode || (SoftMeshBindingMode = {}));
/**
 * Describes how a deformable collider is bound to the cluster of a soft body.
 */
export class SoftMeshBinding {
    constructor(mode) {
        this.mode = mode;
        this.particles = new Uint32Array(0);
        this.eps = 0.0;
        this.selfContacts = false;
    }
    /**
     * Binds vertex `i` of the mesh to `particles[i]`, which must belong to the cluster.
     */
    static direct(particles) {
        let res = new SoftMeshBinding(SoftMeshBindingMode.Direct);
        res.particles = Uint32Array.from(particles);
        return res;
    }
    /**
     * Binds every vertex to the particle of the cluster closest to it, within `eps`.
     */
    static directByPosition(eps) {
        let res = new SoftMeshBinding(SoftMeshBindingMode.DirectByPosition);
        res.eps = eps;
        return res;
    }
    /**
     * Binds every vertex to the cell of the cluster holding it (cage simulation).
     */
    static skinned() {
        return new SoftMeshBinding(SoftMeshBindingMode.Skinned);
    }
    /**
     * Enables collisions of this mesh with itself.
     */
    setSelfContacts(enabled) {
        this.selfContacts = enabled;
        return this;
    }
    /** @internal */
    rawMode() {
        return this.mode;
    }
}
/**
 * The material of a soft body: the softness of its constraints, its elasticity, plasticity
 * and tearing thresholds.
 *
 * A material is a plain JavaScript object; pass it to `SoftBodyDesc.setMaterial` or
 * `SoftBody.setMaterial` to apply it.
 */
export class SoftBodyMaterial {
    constructor() {
        SoftBodyMaterial.copyFromRaw(this, new RawSoftBodyMaterial(), true);
    }
    /**
     * A material whose edge, bend, volume and shape-matching softness all take the same value.
     */
    static uniform(naturalFrequency, dampingRatio) {
        let res = new SoftBodyMaterial();
        let raw = RawSoftBodyMaterial.uniform(naturalFrequency, dampingRatio);
        SoftBodyMaterial.copyFromRaw(res, raw, true);
        return res;
    }
    /** @internal */
    static fromRaw(raw) {
        let res = new SoftBodyMaterial();
        SoftBodyMaterial.copyFromRaw(res, raw, true);
        return res;
    }
    /** @internal */
    static copyFromRaw(target, raw, freeRaw) {
        var _a, _b, _c;
        target.edgeSoftness = {
            naturalFrequency: raw.edgeFrequency,
            dampingRatio: raw.edgeDampingRatio,
        };
        target.bendSoftness = {
            naturalFrequency: raw.bendFrequency,
            dampingRatio: raw.bendDampingRatio,
        };
        target.volumeSoftness = {
            naturalFrequency: raw.volumeFrequency,
            dampingRatio: raw.volumeDampingRatio,
        };
        target.shapeMatchingSoftness = {
            naturalFrequency: raw.shapeMatchingFrequency,
            dampingRatio: raw.shapeMatchingDampingRatio,
        };
        target.youngModulus = raw.youngModulus;
        target.poissonRatio = raw.poissonRatio;
        target.elasticDampingRatio = raw.elasticDampingRatio;
        target.plasticYield = raw.plasticYield;
        target.plasticCreep = raw.plasticCreep;
        target.plasticMax = raw.plasticMax;
        target.deformationDamping = raw.deformationDamping;
        target.edgePlasticYield = raw.edgePlasticYield;
        target.edgePlasticCreep = raw.edgePlasticCreep;
        target.edgePlasticMax = raw.edgePlasticMax;
        target.edgePlasticFlow =
            raw.edgePlasticFlow;
        target.tearStrain = (_a = raw.tearStrain) !== null && _a !== void 0 ? _a : null;
        target.tearForce = (_b = raw.tearForce) !== null && _b !== void 0 ? _b : null;
        target.tearSmoothing = raw.tearSmoothing;
        target.interiorStrength = raw.interiorStrength;
        target.maxTearsPerStep = raw.maxTearsPerStep;
        target.minPiece = (_c = raw.minPiece) !== null && _c !== void 0 ? _c : null;
        if (freeRaw) {
            raw.free();
        }
    }
    /** @internal */
    intoRaw() {
        var _a, _b, _c;
        let raw = new RawSoftBodyMaterial();
        raw.edgeFrequency = this.edgeSoftness.naturalFrequency;
        raw.edgeDampingRatio = this.edgeSoftness.dampingRatio;
        raw.bendFrequency = this.bendSoftness.naturalFrequency;
        raw.bendDampingRatio = this.bendSoftness.dampingRatio;
        raw.volumeFrequency = this.volumeSoftness.naturalFrequency;
        raw.volumeDampingRatio = this.volumeSoftness.dampingRatio;
        raw.shapeMatchingFrequency =
            this.shapeMatchingSoftness.naturalFrequency;
        raw.shapeMatchingDampingRatio = this.shapeMatchingSoftness.dampingRatio;
        raw.youngModulus = this.youngModulus;
        raw.poissonRatio = this.poissonRatio;
        raw.elasticDampingRatio = this.elasticDampingRatio;
        raw.plasticYield = this.plasticYield;
        raw.plasticCreep = this.plasticCreep;
        raw.plasticMax = this.plasticMax;
        raw.deformationDamping = this.deformationDamping;
        raw.edgePlasticYield = this.edgePlasticYield;
        raw.edgePlasticCreep = this.edgePlasticCreep;
        raw.edgePlasticMax = this.edgePlasticMax;
        raw.edgePlasticFlow = this
            .edgePlasticFlow;
        raw.tearStrain = (_a = this.tearStrain) !== null && _a !== void 0 ? _a : undefined;
        raw.tearForce = (_b = this.tearForce) !== null && _b !== void 0 ? _b : undefined;
        raw.tearSmoothing = this.tearSmoothing;
        raw.interiorStrength = this.interiorStrength;
        raw.maxTearsPerStep = this.maxTearsPerStep;
        raw.minPiece = (_c = this.minPiece) !== null && _c !== void 0 ? _c : undefined;
        return raw;
    }
}
/**
 * A soft body: particles linked by elastic constraints (edges, bending constraints and
 * cells), simulated together with the rigid bodies, contacts and joints of the world.
 *
 * A soft body lives in a `SoftBodySet` and is referenced by its integer `handle`. Its hidden
 * root rigid body (`rootBody()`) stands for the whole body in joints and islands; its clusters
 * add more rigid-body proxies that joints and colliders can attach to.
 */
export class SoftBody {
    constructor(rawSet, bodies, colliders, handle) {
        this.rawSet = rawSet;
        this.bodies = bodies;
        this.colliders = colliders;
        this.handle = handle;
    }
    /** @internal */
    finalizeDeserialization(bodies, colliders) {
        this.bodies = bodies;
        this.colliders = colliders;
    }
    /**
     * Checks if this soft body is still valid (i.e. that it has not been deleted from the
     * soft-body set yet).
     */
    isValid() {
        return this.rawSet.contains(this.handle);
    }
    /**
     * A counter incremented by every change of the body's topology (tears, cuts, splits).
     */
    topologyVersion() {
        return this.rawSet.sbTopologyVersion(this.handle);
    }
    /*
     * Particles.
     */
    /**
     * The number of particles of this soft body.
     */
    numParticles() {
        return this.rawSet.sbNumParticles(this.handle);
    }
    /**
     * The world-space position of the `i`-th particle.
     */
    particlePosition(i, target) {
        this.rawSet.sbParticlePosition(this.handle, i, scratchBuffer);
        return VectorOps.fromBuffer(scratchBuffer, target);
    }
    /**
     * The world-space positions of every particle, flattened (two or three floats per
     * particle).
     */
    particlePositions() {
        return this.rawSet.sbParticlePositions(this.handle);
    }
    /**
     * The velocity of the `i`-th particle.
     */
    particleVelocity(i, target) {
        this.rawSet.sbParticleVelocity(this.handle, i, scratchBuffer);
        return VectorOps.fromBuffer(scratchBuffer, target);
    }
    /**
     * The velocities of every particle, flattened (two or three floats per particle).
     */
    particleVelocities() {
        return this.rawSet.sbParticleVelocities(this.handle);
    }
    /**
     * The rest position of the `i`-th particle (the position its constraints hold it at).
     */
    particleRestPosition(i, target) {
        this.rawSet.sbParticleRestPosition(this.handle, i, scratchBuffer);
        return VectorOps.fromBuffer(scratchBuffer, target);
    }
    /**
     * The mass of the `i`-th particle.
     */
    particleMass(i) {
        return this.rawSet.sbParticleMass(this.handle, i);
    }
    /**
     * Is the `i`-th particle pinned (held in place)?
     */
    isParticlePinned(i) {
        return this.rawSet.sbIsParticlePinned(this.handle, i);
    }
    /**
     * Does the `i`-th particle lie on the body's surface?
     */
    isParticleOnSurface(i) {
        return this.rawSet.sbIsParticleOnSurface(this.handle, i);
    }
    /**
     * Has an element of the `i`-th particle torn?
     */
    isParticleDamaged(i) {
        return this.rawSet.sbIsParticleDamaged(this.handle, i);
    }
    /**
     * Sets the world-space position of the `i`-th particle.
     */
    setParticlePosition(i, position) {
        let rawPos = VectorOps.intoRaw(position);
        this.rawSet.sbSetParticlePosition(this.handle, i, rawPos);
        rawPos.free();
    }
    /**
     * Sets the velocity of the `i`-th particle.
     */
    setParticleVelocity(i, velocity) {
        let rawVel = VectorOps.intoRaw(velocity);
        this.rawSet.sbSetParticleVelocity(this.handle, i, rawVel);
        rawVel.free();
    }
    /**
     * Moves the pinned `i`-th particle to `position` over the next step, like a
     * position-based kinematic body (it pushes what it meets), then holds it there.
     * Ignored for a free particle.
     */
    setParticleKinematicTarget(i, position) {
        let rawPos = VectorOps.intoRaw(position);
        this.rawSet.sbSetParticleKinematicTarget(this.handle, i, rawPos);
        rawPos.free();
    }
    /**
     * Pins (or releases) the `i`-th particle.
     */
    setParticlePinned(i, pinned) {
        this.rawSet.sbSetParticlePinned(this.handle, i, pinned);
    }
    /**
     * Attaches the `i`-th particle to a rigid body, at the particle's current position.
     */
    attachParticle(i, body) {
        this.rawSet.sbAttachParticle(this.handle, i, body.handle, this.bodies.raw);
    }
    /**
     * Detaches the `i`-th particle from the rigid body it was attached to.
     *
     * Returns `false` if the particle was not attached.
     */
    detachParticle(i) {
        return this.rawSet.sbDetachParticle(this.handle, i);
    }
    /**
     * The number of particles attached to rigid bodies.
     */
    numAttachments() {
        return this.rawSet.sbNumAttachments(this.handle);
    }
    /**
     * The particle of the `i`-th attachment.
     */
    attachmentParticle(i) {
        return this.rawSet.sbAttachmentParticle(this.handle, i);
    }
    /**
     * The rigid body of the `i`-th attachment.
     */
    attachmentBody(i) {
        return this.bodies.get(this.rawSet.sbAttachmentBody(this.handle, i));
    }
    /*
     * Elements.
     */
    /**
     * The number of edges (structural and bending) of this soft body.
     */
    numEdges() {
        return this.rawSet.sbNumEdges(this.handle);
    }
    /**
     * The particle pairs of every edge, flattened (two indices per edge).
     */
    edges() {
        return this.rawSet.sbEdges(this.handle);
    }
    /**
     * The rest length of the `i`-th edge.
     */
    edgeRestLength(i) {
        return this.rawSet.sbEdgeRestLength(this.handle, i);
    }
    /**
     * Is the `i`-th edge a bending edge (rather than a structural one)?
     */
    isEdgeBend(i) {
        return this.rawSet.sbEdgeIsBend(this.handle, i);
    }
    /**
     * The impulse applied by the `i`-th edge during the last step.
     */
    edgeImpulse(i) {
        return this.rawSet.sbEdgeImpulse(this.handle, i);
    }
    /**
     * The load of the `i`-th edge relative to its tear threshold (`1` tears it).
     */
    edgeStress(i) {
        return this.rawSet.sbEdgeStress(this.handle, i);
    }
    /**
     * The relative change of the `i`-th edge's rest length due to plastic flow.
     */
    edgePlasticStrain(i) {
        return this.rawSet.sbEdgePlasticStrain(this.handle, i);
    }
    /**
     * The multiplier of the tear thresholds of the `i`-th edge.
     */
    edgeTearResistance(i) {
        return this.rawSet.sbEdgeTearResistance(this.handle, i);
    }
    /**
     * The number of cells (triangles in 2D, tetrahedra in 3D) of this soft body.
     */
    numCells() {
        return this.rawSet.sbNumCells(this.handle);
    }
    /**
     * The particles of every cell, flattened (three indices per cell in 2D, four in 3D).
     */
    cells() {
        return this.rawSet.sbCells(this.handle);
    }
    /**
     * The rest area/volume of the `i`-th cell.
     */
    cellRestVolume(i) {
        return this.rawSet.sbCellRestVolume(this.handle, i);
    }
    /**
     * The load of the `i`-th cell relative to its tear threshold (`1` tears it).
     */
    cellStress(i) {
        return this.rawSet.sbCellStress(this.handle, i);
    }
    /**
     * The stiffness multiplier of the `i`-th cell.
     */
    cellStiffnessScale(i) {
        return this.rawSet.sbCellStiffnessScale(this.handle, i);
    }
    /**
     * The multiplier of the tear thresholds of the `i`-th cell.
     */
    cellTearResistance(i) {
        return this.rawSet.sbCellTearResistance(this.handle, i);
    }
    // #if DIM3
    /**
     * The number of dihedral bending constraints of this soft body.
     */
    numDihedrals() {
        return this.rawSet.sbNumDihedrals(this.handle);
    }
    /**
     * The particles of every dihedral, flattened (four indices per dihedral: the shared edge,
     * then the two opposite vertices).
     */
    dihedrals() {
        return this.rawSet.sbDihedrals(this.handle);
    }
    /**
     * The rest angle of the `i`-th dihedral.
     */
    dihedralRestAngle(i) {
        return this.rawSet.sbDihedralRestAngle(this.handle, i);
    }
    // #endif
    /**
     * The boundary elements of this soft body (segments in 2D, triangles in 3D), flattened
     * (two or three particle indices per element), oriented outward.
     */
    boundary() {
        return this.rawSet.sbBoundary(this.handle);
    }
    /*
     * Material.
     */
    /**
     * A copy of this soft body's material.
     */
    material() {
        return SoftBodyMaterial.fromRaw(this.rawSet.sbMaterial(this.handle));
    }
    /**
     * Replaces this soft body's material.
     */
    setMaterial(material) {
        let raw = material.intoRaw();
        this.rawSet.sbSetMaterial(this.handle, raw);
        raw.free();
    }
    /**
     * The constitutive model of this soft body's cells.
     */
    cellModel() {
        return this.rawSet.sbCellModel(this.handle);
    }
    /**
     * The solver holding the cells of this soft body together.
     */
    solver() {
        return this.rawSet.sbSolver(this.handle);
    }
    /**
     * Sets the solver holding the cells of this soft body together.
     */
    setSolver(solver) {
        this.rawSet.sbSetSolver(this.handle, solver);
    }
    /**
     * Is the global area/volume preservation of this soft body enabled?
     */
    volumePreservationEnabled() {
        return this.rawSet.sbVolumePreservationEnabled(this.handle);
    }
    /**
     * Enables or disables the global area/volume preservation of this soft body.
     */
    enableVolumePreservation(enabled) {
        this.rawSet.sbEnableVolumePreservation(this.handle, enabled);
    }
    /**
     * The rest area/volume enclosed by this soft body's closed surfaces.
     */
    restVolume() {
        return this.rawSet.sbRestVolume(this.handle);
    }
    /**
     * The current area/volume enclosed by this soft body's closed surfaces.
     */
    volume() {
        return this.rawSet.sbVolume(this.handle);
    }
    /**
     * The target volume multiplier of the volume preservation (`> 1` inflates the body).
     */
    volumeFactor() {
        return this.rawSet.sbVolumeFactor(this.handle);
    }
    /**
     * Sets the target volume multiplier of the volume preservation (`> 1` inflates the body).
     */
    setVolumeFactor(factor) {
        this.rawSet.sbSetVolumeFactor(this.handle, factor);
    }
    /**
     * The thickness of this soft body's particles.
     */
    particleRadius() {
        return this.rawSet.sbParticleRadius(this.handle);
    }
    /**
     * Forgets every plastic deformation: the rest shapes return to their initial values.
     */
    resetPlasticity() {
        this.rawSet.sbResetPlasticity(this.handle);
    }
    /*
     * Whole-body state.
     */
    /**
     * The hidden rigid body standing for this soft body in joints and islands.
     */
    rootBody() {
        return this.bodies.get(this.rawSet.sbRootBody(this.handle));
    }
    /**
     * The soft body this one was split off from by a tear, if any.
     */
    origin() {
        let origin = this.rawSet.sbOrigin(this.handle);
        return origin === undefined ? null : origin;
    }
    /**
     * The handles of the soft bodies that tears split off from this one.
     */
    pieces() {
        return Array.from(this.rawSet.sbPieces(this.handle));
    }
    /**
     * The center of mass of this soft body's particles.
     */
    centerOfMass(target) {
        this.rawSet.sbCenterOfMass(this.handle, scratchBuffer);
        return VectorOps.fromBuffer(scratchBuffer, target);
    }
    /**
     * The total mass of this soft body's particles.
     */
    mass() {
        return this.rawSet.sbMass(this.handle);
    }
    /**
     * Is this soft body sleeping?
     */
    isSleeping() {
        return this.rawSet.sbIsSleeping(this.handle);
    }
    /**
     * Wakes this soft body up.
     */
    wakeUp() {
        this.rawSet.sbWakeUp(this.handle);
    }
    /**
     * Is this soft body enabled (simulated)?
     */
    isEnabled() {
        return this.rawSet.sbIsEnabled(this.handle);
    }
    /**
     * Enables or disables this soft body.
     */
    setEnabled(enabled) {
        this.rawSet.sbSetEnabled(this.handle, enabled);
    }
    /**
     * Sets the extra internal PGS iterations run per substep for this soft body and
     * everything it touches.
     */
    setAdditionalPgsIterations(iterations) {
        this.rawSet.sbSetAdditionalPgsIterations(this.handle, iterations);
    }
    /**
     * The linear damping of this soft body's particles.
     */
    linearDamping() {
        return this.rawSet.sbLinearDamping(this.handle);
    }
    /**
     * The gravity scale of this soft body's particles.
     */
    gravityScale() {
        return this.rawSet.sbGravityScale(this.handle);
    }
    /*
     * Forces and impulses.
     */
    /**
     * Adds a force to every particle of this soft body (spread by mass).
     */
    addForce(force, wakeUp) {
        let rawForce = VectorOps.intoRaw(force);
        this.rawSet.sbAddForce(this.handle, rawForce, wakeUp);
        rawForce.free();
    }
    /**
     * Adds a force to the `i`-th particle of this soft body.
     */
    addParticleForce(i, force, wakeUp) {
        let rawForce = VectorOps.intoRaw(force);
        this.rawSet.sbAddParticleForce(this.handle, i, rawForce, wakeUp);
        rawForce.free();
    }
    /**
     * Resets the user forces applied to this soft body's particles.
     */
    resetForces(wakeUp) {
        this.rawSet.sbResetForces(this.handle, wakeUp);
    }
    /**
     * Applies an impulse to every particle of this soft body (spread by mass).
     */
    applyImpulse(impulse, wakeUp) {
        let rawImpulse = VectorOps.intoRaw(impulse);
        this.rawSet.sbApplyImpulse(this.handle, rawImpulse, wakeUp);
        rawImpulse.free();
    }
    /**
     * Applies an impulse to the `i`-th particle of this soft body.
     */
    applyParticleImpulse(i, impulse, wakeUp) {
        let rawImpulse = VectorOps.intoRaw(impulse);
        this.rawSet.sbApplyParticleImpulse(this.handle, i, rawImpulse, wakeUp);
        rawImpulse.free();
    }
    /**
     * Applies an impulse to the particles within `falloffRadius` of `point`, scaled down
     * linearly with their distance to it (`falloffRadius <= 0` applies it to every particle).
     */
    applyImpulseAtPoint(impulse, point, falloffRadius, wakeUp) {
        let rawImpulse = VectorOps.intoRaw(impulse);
        let rawPoint = VectorOps.intoRaw(point);
        this.rawSet.sbApplyImpulseAtPoint(this.handle, rawImpulse, rawPoint, falloffRadius, wakeUp);
        rawImpulse.free();
        rawPoint.free();
    }
    /**
     * Applies an impulse of the given magnitude pushing the particles away from `center`
     * (a blast), scaled down linearly up to `falloffRadius`.
     */
    applyRadialImpulse(center, magnitude, falloffRadius, wakeUp) {
        let rawCenter = VectorOps.intoRaw(center);
        this.rawSet.sbApplyRadialImpulse(this.handle, rawCenter, magnitude, falloffRadius, wakeUp);
        rawCenter.free();
    }
    /*
     * Tearing.
     */
    /**
     * Requests the `i`-th edge to tear at the end of the next step.
     */
    tearEdge(i) {
        this.rawSet.sbTearEdge(this.handle, i);
    }
    /**
     * Requests the `i`-th cell to tear at the end of the next step.
     */
    tearCell(i) {
        this.rawSet.sbTearCell(this.handle, i);
    }
    /**
     * Are there tears requested for the next step?
     */
    hasPendingTears() {
        return this.rawSet.sbHasPendingTears(this.handle);
    }
    /*
     * Clusters.
     */
    /**
     * The number of cluster slots of this soft body (some may have been removed: see
     * `isClusterLive`).
     */
    numClusters() {
        return this.rawSet.sbNumClusters(this.handle);
    }
    /**
     * Does the `i`-th cluster still exist?
     */
    isClusterLive(i) {
        return this.rawSet.sbIsClusterLive(this.handle, i);
    }
    /**
     * The rigid body standing for the `i`-th cluster: joints and colliders attach to it.
     */
    clusterProxy(i) {
        let proxy = this.rawSet.sbClusterProxy(this.handle, i);
        return proxy === undefined ? null : this.bodies.get(proxy);
    }
    /**
     * The particles of the `i`-th cluster.
     */
    clusterParticles(i) {
        return this.rawSet.sbClusterParticles(this.handle, i);
    }
    /**
     * Does the `i`-th cluster hold its shape by shape matching?
     */
    clusterShapeMatchingEnabled(i) {
        return this.rawSet.sbClusterShapeMatchingEnabled(this.handle, i);
    }
    /**
     * Enables or disables shape matching on the `i`-th cluster.
     */
    enableClusterShapeMatching(i, enabled) {
        this.rawSet.sbEnableClusterShapeMatching(this.handle, i, enabled);
    }
    /**
     * Scales the stiffness of the elements of the `i`-th cluster.
     */
    setClusterStiffnessScale(i, scale) {
        this.rawSet.sbSetClusterStiffnessScale(this.handle, i, scale);
    }
    /**
     * Overrides the softness of the edges of the `i`-th cluster (`null` restores the
     * material's).
     */
    setClusterEdgeSoftness(i, softness) {
        this.rawSet.sbSetClusterEdgeSoftness(this.handle, i, softness ? softness.naturalFrequency : undefined, softness ? softness.dampingRatio : undefined);
    }
    /**
     * Scales the tear thresholds of the elements of the `i`-th cluster.
     */
    setClusterTearResistance(i, resistance) {
        this.rawSet.sbSetClusterTearResistance(this.handle, i, resistance);
    }
    /**
     * Pins (or releases) every particle of the `i`-th cluster.
     */
    setClusterPinned(i, pinned) {
        this.rawSet.sbSetClusterPinned(this.handle, i, pinned);
    }
    /**
     * Moves the `i`-th cluster rigidly to the given pose over the next step.
     */
    setClusterKinematicTarget(i, translation, rotation) {
        let rawTra = VectorOps.intoRaw(translation);
        let rawRot = RotationOps.intoRaw(rotation);
        this.rawSet.sbSetClusterKinematicTarget(this.handle, i, rawTra, rawRot);
        rawTra.free();
        rawRot.free();
    }
    /*
     * Collision meshes.
     */
    /**
     * The number of collision meshes held by this soft body's clusters (its own deformable
     * surface included).
     */
    numMeshes() {
        return this.rawSet.sbNumMeshes(this.handle);
    }
    /**
     * The cluster holding the `i`-th collision mesh.
     */
    meshCluster(i) {
        let cluster = this.rawSet.sbMeshCluster(this.handle, i);
        return cluster === undefined ? null : cluster;
    }
    /**
     * The collider holding the `i`-th collision mesh.
     */
    meshCollider(i) {
        let collider = this.rawSet.sbMeshCollider(this.handle, i);
        return collider === undefined ? null : this.colliders.get(collider);
    }
    /**
     * Is the `i`-th collision mesh skinned (embedded in the cells) rather than bound
     * vertex-to-particle?
     */
    isMeshSkinned(i) {
        return this.rawSet.sbMeshIsSkinned(this.handle, i);
    }
    /**
     * Does the `i`-th collision mesh collide?
     */
    meshCollisionEnabled(i) {
        return this.rawSet.sbMeshCollisionEnabled(this.handle, i);
    }
    /**
     * Does the shape of the `i`-th collision mesh carry the `ORIENTED` flag (see
     * `SoftBodyDesc.setOriented`)?
     */
    isMeshOriented(i) {
        return this.rawSet.sbMeshIsOriented(this.handle, i);
    }
    /**
     * The world-space vertex positions of the `i`-th collision mesh, flattened.
     */
    meshVertices(i) {
        return this.rawSet.sbMeshVertices(this.handle, i);
    }
    /**
     * The elements of the `i`-th collision mesh, flattened (two vertex indices per segment in
     * 2D, three per triangle in 3D).
     */
    meshIndices(i) {
        return this.rawSet.sbMeshIndices(this.handle, i);
    }
    /**
     * The index of the collision mesh held by a deformable collider of this soft body.
     */
    meshOfCollider(collider) {
        let mesh = this.rawSet.sbMeshOfCollider(this.handle, collider.handle);
        return mesh === undefined ? null : mesh;
    }
}
/**
 * The description of a soft body to create.
 *
 * Start from one of the generators (`SoftBodyDesc.rope`, `cloth`, `cuboid`, `sphere`,
 * `trimesh`, `volumetric` in 3D; `rope`, `polygon`, `disk`, `grid`, `polyline`, `volumetric`
 * in 2D) or from raw particle positions, then tune it with the chainable setters. The
 * description holds no WASM memory: it is applied when the soft body is created.
 */
export class SoftBodyDesc {
    /**
     * A description over raw world-space particle positions (flattened), with no element:
     * add edges, cells and a surface with the setters.
     */
    constructor(positions) {
        let flat = positions
            ? Float32Array.from(positions)
            : new Float32Array(0);
        this.generator = () => new RawSoftBodyBuilder(flat);
        this.setters = [];
        this.material = null;
        this.softness = null;
        this.particleMass = 1.0;
        this.mass = null;
        this.masses = null;
        this.pinnedParticles = new Uint32Array(0);
        this.cellModel = SoftBodyCellModel.Volume;
        this.solver = SoftBodySolver.Constraints;
        this.volumePreservation = null;
        this.volumeFactor = 1.0;
        this.shapeMatching = null;
        this.selfContacts = false;
        this.oriented = null;
        this.particleRadius = null;
        this.surfaceCollider = ColliderDesc.ball(0.05);
        this.skinCollision = false;
        this.translation = null;
        this.linearDamping = 0.0;
        this.gravityScale = 1.0;
        this.additionalSolverIterations = 0;
        this.additionalPgsIterations = 3;
        this.canSleep = true;
        this.dominanceGroup = 0;
    }
    static withGenerator(generator) {
        // Run it once to know whether the geometry is valid.
        let probe = generator();
        if (!probe) {
            return null;
        }
        probe.free();
        let desc = new SoftBodyDesc();
        desc.generator = generator;
        return desc;
    }
    /**
     * A rope of `numParticles` particles from `start` to `end`.
     */
    static rope(start, end, numParticles) {
        return SoftBodyDesc.withGenerator(() => {
            let rawStart = VectorOps.intoRaw(start);
            let rawEnd = VectorOps.intoRaw(end);
            let raw = RawSoftBodyBuilder.rope(rawStart, rawEnd, numParticles);
            rawStart.free();
            rawEnd.free();
            return raw;
        });
    }
    /**
     * A body filling the closed surface (segments in 2D, triangles in 3D) with cells of the
     * given size; `skinned` keeps the surface as a skin embedded in the cells. Returns
     * `null` if the surface cannot be meshed.
     *
     * @param vertices - The flattened world-space vertices of the surface.
     * @param indices - The flattened elements of the surface.
     */
    static volumetric(vertices, indices, cellSize, skinned = false) {
        return SoftBodyDesc.withGenerator(() => RawSoftBodyBuilder.volumetric(vertices, indices, cellSize, skinned));
    }
    // #if DIM3
    /**
     * A triangle-mesh body without cells: the vertices are particles, the triangles the
     * surface, held by dihedral bending and shape matching. Returns `null` if the mesh is
     * empty.
     */
    static trimesh(vertices, indices) {
        return SoftBodyDesc.withGenerator(() => RawSoftBodyBuilder.trimesh(vertices, indices));
    }
    /**
     * A cloth of `nu` by `nv` particles: particle `(i, j)` is at `origin + i * du + j * dv`.
     */
    static cloth(origin, du, dv, nu, nv) {
        return SoftBodyDesc.withGenerator(() => {
            let rawOrigin = VectorOps.intoRaw(origin);
            let rawDu = VectorOps.intoRaw(du);
            let rawDv = VectorOps.intoRaw(dv);
            let raw = RawSoftBodyBuilder.cloth(rawOrigin, rawDu, rawDv, nu, nv);
            rawOrigin.free();
            rawDu.free();
            rawDv.free();
            return raw;
        });
    }
    /**
     * A tube of cloth around `axis`, from `radiusStart` at `origin` to `radiusEnd` at its
     * other end, with `numAround` particles per ring and `numAlong` rings.
     */
    static clothTube(origin, axis, radiusStart, radiusEnd, numAround, numAlong) {
        return SoftBodyDesc.withGenerator(() => {
            let rawOrigin = VectorOps.intoRaw(origin);
            let rawAxis = VectorOps.intoRaw(axis);
            let raw = RawSoftBodyBuilder.clothTube(rawOrigin, rawAxis, radiusStart, radiusEnd, numAround, numAlong);
            rawOrigin.free();
            rawAxis.free();
            return raw;
        });
    }
    /**
     * A cloth with different softness along `du` (warp), along `dv` (weft) and across the
     * diagonals (shear).
     */
    static clothAnisotropic(origin, du, dv, nu, nv, warp, weft, shear) {
        return SoftBodyDesc.withGenerator(() => {
            let rawOrigin = VectorOps.intoRaw(origin);
            let rawDu = VectorOps.intoRaw(du);
            let rawDv = VectorOps.intoRaw(dv);
            let raw = RawSoftBodyBuilder.clothAnisotropic(rawOrigin, rawDu, rawDv, nu, nv, warp.naturalFrequency, warp.dampingRatio, weft.naturalFrequency, weft.dampingRatio, shear.naturalFrequency, shear.dampingRatio);
            rawOrigin.free();
            rawDu.free();
            rawDv.free();
            return raw;
        });
    }
    /**
     * A box of `nx` by `ny` by `nz` particles filled with tetrahedral cells.
     */
    static cuboid(center, halfExtents, nx, ny, nz) {
        return SoftBodyDesc.withGenerator(() => {
            let rawCenter = VectorOps.intoRaw(center);
            let rawHalf = VectorOps.intoRaw(halfExtents);
            let raw = RawSoftBodyBuilder.cuboid(rawCenter, rawHalf, nx, ny, nz);
            rawCenter.free();
            rawHalf.free();
            return raw;
        });
    }
    /**
     * A hollow sphere: an icosphere surface with `subdivisions` refinement levels, holding
     * its volume (a balloon).
     */
    static sphere(center, radius, subdivisions) {
        return SoftBodyDesc.withGenerator(() => {
            let rawCenter = VectorOps.intoRaw(center);
            let raw = RawSoftBodyBuilder.sphere(rawCenter, radius, subdivisions);
            rawCenter.free();
            return raw;
        });
    }
    // #endif
    /*
     * Chainable setters.
     */
    /**
     * Sets the material of the soft body.
     */
    setMaterial(material) {
        this.material = material;
        return this;
    }
    /**
     * Sets a uniform softness for every constraint of the material.
     */
    setSoftness(naturalFrequency, dampingRatio) {
        this.softness = { naturalFrequency, dampingRatio };
        return this;
    }
    /**
     * Sets the uniform mass of the particles.
     */
    setParticleMass(mass) {
        this.particleMass = mass;
        this.masses = null;
        return this;
    }
    /**
     * Sets the total mass of the body, spread over its particles.
     */
    setMass(mass) {
        this.mass = mass;
        return this;
    }
    /**
     * Sets per-particle masses.
     */
    setMasses(masses) {
        this.masses = Float32Array.from(masses);
        return this;
    }
    /**
     * Pins the given particles in place.
     */
    setPinnedParticles(pinned) {
        this.pinnedParticles = Uint32Array.from(pinned);
        return this;
    }
    /**
     * Replaces the structural edges (flattened particle pairs).
     */
    setEdges(edges) {
        let flat = Uint32Array.from(edges);
        this.setters.push((raw) => raw.setEdges(flat));
        return this;
    }
    /**
     * Adds structural edges (flattened particle pairs).
     */
    addEdges(edges) {
        let flat = Uint32Array.from(edges);
        this.setters.push((raw) => raw.addEdges(flat));
        return this;
    }
    /**
     * Replaces the bending edges (flattened particle pairs).
     */
    setBendEdges(edges) {
        let flat = Uint32Array.from(edges);
        this.setters.push((raw) => raw.setBendEdges(flat));
        return this;
    }
    /**
     * Makes every edge resist stretching only (a rope or a net that folds freely).
     */
    setTensionOnly() {
        this.setters.push((raw) => raw.setTensionOnly());
        return this;
    }
    // #if DIM3
    /**
     * Replaces the dihedral bending constraints (flattened quadruplets: the shared edge, then
     * the two opposite vertices).
     */
    setDihedrals(dihedrals) {
        let flat = Uint32Array.from(dihedrals);
        this.setters.push((raw) => raw.setDihedrals(flat));
        return this;
    }
    /**
     * Sets the segments a body without surface collides through (a wire).
     */
    setWire(segments) {
        let flat = Uint32Array.from(segments);
        this.setters.push((raw) => raw.setWire(flat));
        return this;
    }
    // #endif
    /**
     * Replaces the cells (flattened triangles in 2D, tetrahedra in 3D).
     */
    setCells(cells) {
        let flat = Uint32Array.from(cells);
        this.setters.push((raw) => raw.setCells(flat));
        return this;
    }
    /**
     * Replaces the boundary elements (flattened segments in 2D, triangles in 3D), oriented
     * outward.
     */
    setSurface(surface) {
        let flat = Uint32Array.from(surface);
        this.setters.push((raw) => raw.setSurface(flat));
        return this;
    }
    /**
     * Sets a skin: a finer mesh (flattened world-space vertices and elements) embedded in the
     * cells, which follows them.
     */
    setSkin(vertices, indices) {
        let flatVertices = Float32Array.from(vertices);
        let flatIndices = Uint32Array.from(indices);
        this.setters.push((raw) => raw.setSkin(flatVertices, flatIndices));
        return this;
    }
    /**
     * Makes the body collide through its skin rather than through its cells' boundary.
     */
    setSkinCollision(enabled) {
        this.skinCollision = enabled;
        return this;
    }
    /**
     * Overrides the softness of the given edges.
     */
    setEdgeSoftness(edges, softness) {
        let flatEdges = Uint32Array.from(edges);
        let frequencies = Float32Array.from(softness.map((s) => s.naturalFrequency));
        let dampings = Float32Array.from(softness.map((s) => s.dampingRatio));
        this.setters.push((raw) => raw.setEdgeSoftness(flatEdges, frequencies, dampings));
        return this;
    }
    /**
     * Multiplies the tear thresholds of the given edges.
     */
    setEdgeTearResistance(edges, resistances) {
        let flatEdges = Uint32Array.from(edges);
        let flatResistances = Float32Array.from(resistances);
        this.setters.push((raw) => raw.setEdgeTearResistance(flatEdges, flatResistances));
        return this;
    }
    /**
     * Sets the constitutive model of the cells.
     */
    setCellModel(model) {
        this.cellModel = model;
        return this;
    }
    /**
     * Sets the solver holding the cells together (`SoftBodySolver.Fem` needs cells).
     */
    setSolver(solver) {
        this.solver = solver;
        return this;
    }
    /**
     * Enables the preservation of the area/volume enclosed by the body's closed surfaces.
     */
    setVolumePreservation(enabled) {
        this.volumePreservation = enabled;
        return this;
    }
    /**
     * Sets the target volume multiplier (`> 1` inflates the body); this also enables the
     * volume preservation.
     */
    setVolumeFactor(factor) {
        this.volumeFactor = factor;
        this.volumePreservation = true;
        return this;
    }
    /**
     * Holds the body's shape by shape matching.
     */
    setShapeMatching(enabled) {
        this.shapeMatching = enabled;
        return this;
    }
    /**
     * Makes the body's surface collide with itself.
     */
    setSelfContacts(enabled) {
        this.selfContacts = enabled;
        return this;
    }
    /**
     * Sets whether the shape of the body's collision surface is built with the `ORIENTED`
     * flag, like a polyline or mesh. Left unset, it is whenever the surface is closed, which
     * is what a solid body wants: an oriented closed surface encloses matter, so nothing is
     * held inside it. Set it to `false` for a shell, whose inner side holds the bodies inside
     * it.
     */
    setOriented(oriented) {
        this.oriented = oriented;
        return this;
    }
    /**
     * Sets the thickness of the particles.
     */
    setParticleRadius(radius) {
        this.particleRadius = radius;
        return this;
    }
    /**
     * Sets the template of the body's colliders: its friction, restitution, groups, events
     * and other settings are kept, its shape is replaced by the body's deformable surface.
     */
    setSurfaceCollider(collider) {
        this.surfaceCollider = collider;
        return this;
    }
    /**
     * Removes the body's colliders: it will not collide with anything.
     */
    setNoSurfaceCollider() {
        this.surfaceCollider = null;
        return this;
    }
    /**
     * Translates every particle.
     */
    setTranslation(translation) {
        this.translation = translation;
        return this;
    }
    /**
     * Sets the linear damping of the particles.
     */
    setLinearDamping(damping) {
        this.linearDamping = damping;
        return this;
    }
    /**
     * Sets the gravity scale of the particles.
     */
    setGravityScale(scale) {
        this.gravityScale = scale;
        return this;
    }
    /**
     * Sets the extra solver substeps requested for the body and everything it touches.
     */
    setAdditionalSolverIterations(iterations) {
        this.additionalSolverIterations = iterations;
        return this;
    }
    /**
     * Sets the extra internal PGS iterations per substep for the body and everything it
     * touches (default: `3`).
     */
    setAdditionalPgsIterations(iterations) {
        this.additionalPgsIterations = iterations;
        return this;
    }
    /**
     * Sets whether the body may fall asleep.
     */
    setCanSleep(canSleep) {
        this.canSleep = canSleep;
        return this;
    }
    /**
     * Sets the dominance group of the body.
     */
    setDominanceGroup(group) {
        this.dominanceGroup = group;
        return this;
    }
    /**
     * Sets the user data associated with the soft body.
     */
    setUserData(data) {
        this.userData = data;
        return this;
    }
    /**
     * Appends the particles and elements of another description to this one.
     */
    append(other) {
        this.setters.push((raw) => {
            let rawOther = other.intoRaw();
            raw.append(rawOther);
            rawOther.free();
        });
        return this;
    }
    /**
     * Builds the WASM-side builder this description stands for. The result must be freed.
     * @internal
     */
    intoRaw() {
        let raw = this.generator();
        for (let setter of this.setters) {
            setter(raw);
        }
        if (this.material) {
            let rawMaterial = this.material.intoRaw();
            raw.setMaterial(rawMaterial);
            rawMaterial.free();
        }
        if (this.softness) {
            raw.setSoftness(this.softness.naturalFrequency, this.softness.dampingRatio);
        }
        if (this.masses) {
            raw.setMasses(this.masses);
        }
        else {
            raw.setParticleMass(this.particleMass);
        }
        if (this.mass !== null) {
            raw.setMass(this.mass);
        }
        raw.setPinnedParticles(this.pinnedParticles);
        raw.setCellModel(this.cellModel);
        raw.setSolver(this.solver);
        // The settings a generator may have chosen are only overridden when set here.
        if (this.volumePreservation !== null) {
            raw.setVolumePreservation(this.volumePreservation);
        }
        raw.setVolumeFactor(this.volumeFactor);
        if (this.shapeMatching !== null) {
            raw.setShapeMatching(this.shapeMatching);
        }
        raw.setSelfContacts(this.selfContacts);
        if (this.oriented !== null) {
            raw.setOriented(this.oriented);
        }
        if (this.particleRadius !== null) {
            raw.setParticleRadius(this.particleRadius);
        }
        raw.setSkinCollision(this.skinCollision);
        if (this.surfaceCollider) {
            let c = this.surfaceCollider;
            raw.setSurfaceCollider(c.friction, c.restitution, c.frictionCombineRule, c.restitutionCombineRule, c.isSensor, c.collisionGroups, c.solverGroups, c.activeCollisionTypes, c.activeHooks, c.activeEvents, c.contactForceEventThreshold, c.contactSkin);
        }
        else {
            raw.setNoSurfaceCollider();
        }
        if (this.translation) {
            let rawTra = VectorOps.intoRaw(this.translation);
            raw.translated(rawTra);
            rawTra.free();
        }
        raw.setLinearDamping(this.linearDamping);
        raw.setGravityScale(this.gravityScale);
        raw.setAdditionalSolverIterations(this.additionalSolverIterations);
        raw.setAdditionalPgsIterations(this.additionalPgsIterations);
        raw.setCanSleep(this.canSleep);
        raw.setDominanceGroup(this.dominanceGroup);
        return raw;
    }
    /**
     * The number of particles the description currently generates.
     */
    numParticles() {
        let raw = this.intoRaw();
        let n = raw.numParticles();
        raw.free();
        return n;
    }
    /**
     * The flattened world-space positions of the particles the description generates.
     */
    particlePositions() {
        let raw = this.intoRaw();
        let positions = raw.particlePositions();
        raw.free();
        return positions;
    }
}
/**
 * The record of a soft body tearing: the elements it lost, the particles the tear split,
 * the pieces the tear separated into soft bodies of their own, and the clusters and joints
 * that moved with them.
 *
 * Events drained from an `EventQueue` are only valid inside the draining closure; events
 * returned by `World.tearSoftBody` and `World.cutSoftBody` must be freed with `.free()`.
 */
export class SoftBodyTearEvent {
    constructor(raw) {
        this.raw = raw;
    }
    free() {
        if (!!this.raw) {
            this.raw.free();
        }
        this.raw = undefined;
    }
    /**
     * The soft body that tore.
     */
    softBody() {
        return this.raw.softBody();
    }
    /**
     * The particle pairs of the edges that tore, flattened.
     */
    tornEdges() {
        return this.raw.tornEdges();
    }
    /**
     * The particles of the cells that tore, flattened.
     */
    tornCells() {
        return this.raw.tornCells();
    }
    /**
     * The particle pairs of the edges the tear removed, flattened.
     */
    removedEdges() {
        return this.raw.removedEdges();
    }
    /**
     * The particles the tear split, flattened as `(original, copy)` pairs.
     */
    splitParticles() {
        return this.raw.splitParticles();
    }
    /**
     * The particles the tear inserted.
     */
    insertedParticles() {
        return this.raw.insertedParticles();
    }
    /**
     * The particle pairs (flattened) the tear started from.
     */
    seeds() {
        return this.raw.seeds();
    }
    /**
     * The number of pieces the tear split off into soft bodies of their own.
     */
    numPieces() {
        return this.raw.numPieces();
    }
    /**
     * The soft body the `i`-th piece became.
     */
    pieceSoftBody(i) {
        return this.raw.pieceSoftBody(i);
    }
    /**
     * The particles (indices in the torn body) that went into the `i`-th piece.
     */
    pieceParticles(i) {
        return this.raw.pieceParticles(i);
    }
    /**
     * The clusters that moved into the `i`-th piece, flattened as `(source, destination)`
     * index pairs.
     */
    pieceClusters(i) {
        return this.raw.pieceClusters(i);
    }
    /**
     * The number of clusters the tear split.
     */
    numClusterSplits() {
        return this.raw.numClusterSplits();
    }
    /**
     * The cluster of the torn body the `i`-th split came from.
     */
    clusterSplitSource(i) {
        return this.raw.clusterSplitSource(i);
    }
    /**
     * The soft body holding the cluster the `i`-th split created.
     */
    clusterSplitSoftBody(i) {
        return this.raw.clusterSplitSoftBody(i);
    }
    /**
     * The index of the cluster the `i`-th split created.
     */
    clusterSplitCluster(i) {
        return this.raw.clusterSplitCluster(i);
    }
    /**
     * The proxy rigid body of the cluster the `i`-th split created.
     */
    clusterSplitProxy(i) {
        return this.raw.clusterSplitProxy(i);
    }
    /**
     * Does the cluster the `i`-th split created keep the source cluster's proxy?
     */
    clusterSplitKeepsProxy(i) {
        return this.raw.clusterSplitKeepsProxy(i);
    }
    /**
     * The number of impulse joints the tear moved to another proxy.
     */
    numMovedJoints() {
        return this.raw.numMovedJoints();
    }
    /**
     * The `i`-th moved impulse joint.
     */
    movedJoint(i) {
        return this.raw.movedJoint(i);
    }
    /**
     * The proxy the `i`-th moved joint was attached to before the tear.
     */
    movedJointFrom(i) {
        return this.raw.movedJointFrom(i);
    }
    /**
     * The proxy the `i`-th moved joint is attached to after the tear.
     */
    movedJointTo(i) {
        return this.raw.movedJointTo(i);
    }
    /**
     * Where a particle of the torn body is after the tear: its soft body and index there, or
     * `null` if the particle was removed.
     */
    particleDestination(particle) {
        let body = this.raw.particleDestinationBody(particle);
        let index = this.raw.particleDestinationIndex(particle);
        if (body === undefined || index === undefined) {
            return null;
        }
        return { softBody: body, particle: index };
    }
}
//# sourceMappingURL=soft_body.js.map