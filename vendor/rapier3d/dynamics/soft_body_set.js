import { RawSoftBodySet } from "../raw.js";
import { Coarena } from "../coarena.js";
import { SoftBody, SoftBodyTearEvent, } from "./soft_body.js";
/**
 * A set of soft bodies that can be handled by a physics pipeline.
 *
 * To avoid leaking WASM resources, this MUST be freed manually with `softBodySet.free()`
 * once you are done using it (and all the soft bodies it created).
 */
export class SoftBodySet {
    /**
     * Release the WASM memory occupied by this soft-body set.
     */
    free() {
        if (!!this.raw) {
            this.raw.free();
        }
        this.raw = undefined;
        if (!!this.map) {
            this.map.clear();
        }
        this.map = undefined;
    }
    constructor(raw) {
        this.raw = raw || new RawSoftBodySet();
        this.map = new Coarena();
        // deserialize
        if (raw) {
            raw.forEachSoftBodyHandle((handle) => {
                this.map.set(handle, new SoftBody(raw, null, null, handle));
            });
        }
    }
    /**
     * Internal method, do not call this explicitly.
     */
    finalizeDeserialization(bodies, colliders) {
        this.map.forEach((sb) => sb.finalizeDeserialization(bodies, colliders));
    }
    /**
     * Creates a new soft body, its hidden root rigid body and its colliders, and returns it.
     *
     * @param bodies - The set of rigid bodies receiving the body's proxies.
     * @param colliders - The set of colliders receiving the body's colliders.
     * @param desc - The description of the soft body to create.
     */
    createSoftBody(bodies, colliders, desc) {
        let rawBuilder = desc.intoRaw();
        let handle = this.raw.insert(rawBuilder, bodies.raw, colliders.raw);
        rawBuilder.free();
        // Map the proxies and colliders the insertion created.
        bodies.mapNewBodies(colliders);
        colliders.mapNewColliders(bodies);
        const body = new SoftBody(this.raw, bodies, colliders, handle);
        body.userData = desc.userData;
        this.map.set(handle, body);
        return body;
    }
    /**
     * Removes a soft body from this set, with its proxies, colliders and attached joints.
     */
    remove(handle, islands, bodies, colliders, impulseJoints, multibodyJoints) {
        this.raw.remove(handle, islands.raw, bodies.raw, colliders.raw, impulseJoints.raw, multibodyJoints.raw);
        this.map.delete(handle);
        // Unmap the proxies, colliders and joints that were removed with the soft body.
        bodies.unmapRemovedBodies();
        colliders.unmapRemovedColliders();
        impulseJoints.unmapRemovedJoints();
        multibodyJoints.unmapRemovedJoints();
    }
    /**
     * Adds a cluster over the given particles: a rigid proxy that joints and colliders can
     * attach to. Returns the cluster's index, or `null` if no particle was valid.
     */
    addCluster(handle, particles, bodies, colliders) {
        let cluster = this.raw.addCluster(handle, Uint32Array.from(particles), bodies.raw, colliders.raw);
        bodies.mapNewBodies(colliders);
        return cluster === undefined ? null : cluster;
    }
    /**
     * Removes a cluster with its proxy, colliders and joints. Returns `false` if the cluster
     * did not exist.
     */
    removeCluster(handle, cluster, islands, bodies, colliders, impulseJoints, multibodyJoints) {
        let removed = this.raw.removeCluster(handle, cluster, islands.raw, bodies.raw, colliders.raw, impulseJoints.raw, multibodyJoints.raw);
        bodies.unmapRemovedBodies();
        colliders.unmapRemovedColliders();
        impulseJoints.unmapRemovedJoints();
        multibodyJoints.unmapRemovedJoints();
        return removed;
    }
    /**
     * Tears a soft body at once along the given edges and through the given cells, without
     * removing material. Pieces disconnected by the tear become soft bodies of their own.
     *
     * Returns the tear event (which must be freed), or `null` when nothing changed.
     */
    tear(handle, edges, cells, islands, bodies, colliders, impulseJoints, multibodyJoints) {
        let raw = this.raw.tear(handle, Uint32Array.from(edges), Uint32Array.from(cells), islands.raw, bodies.raw, colliders.raw, impulseJoints.raw, multibodyJoints.raw);
        return this.finishTopologyChange(raw, bodies, colliders, impulseJoints, multibodyJoints);
    }
    /**
     * Cuts a soft body along a blade: a segment (two points) in 2D, a triangle (three points)
     * in 3D. Pieces disconnected by the cut become soft bodies of their own.
     *
     * Returns the tear event (which must be freed), or `null` when nothing changed.
     */
    cut(handle, blade, islands, bodies, colliders, impulseJoints, multibodyJoints) {
        let flat = [];
        for (let point of blade) {
            flat.push(point.x, point.y);
            // #if DIM3
            flat.push(point.z);
            // #endif
        }
        let raw = this.raw.cut(handle, Float32Array.from(flat), islands.raw, bodies.raw, colliders.raw, impulseJoints.raw, multibodyJoints.raw);
        return this.finishTopologyChange(raw, bodies, colliders, impulseJoints, multibodyJoints);
    }
    /**
     * Maps the soft bodies, proxies and colliders a topology change created, and unmaps what
     * it removed.
     */
    finishTopologyChange(raw, bodies, colliders, impulseJoints, multibodyJoints) {
        if (!raw) {
            return null;
        }
        this.mapNewSoftBodies(bodies, colliders);
        bodies.mapNewBodies(colliders);
        colliders.mapNewColliders(bodies);
        bodies.unmapRemovedBodies();
        colliders.unmapRemovedColliders();
        impulseJoints.unmapRemovedJoints();
        multibodyJoints.unmapRemovedJoints();
        return new SoftBodyTearEvent(raw);
    }
    /**
     * Wraps the soft bodies the engine created (the pieces a tear split off) that have no
     * JavaScript wrapper yet; the pieces of a tear event are only reachable after this.
     */
    mapNewSoftBodies(bodies, colliders) {
        this.raw.forEachSoftBodyHandle((handle) => {
            if (!this.map.get(handle)) {
                this.map.set(handle, new SoftBody(this.raw, bodies, colliders, handle));
            }
        });
    }
    /**
     * Wakes a soft body and everything it touches up.
     *
     * @param strong - If `true` the bodies stay awake for a while even if they are at rest.
     */
    wakeUp(handle, bodies, strong) {
        this.raw.wakeUp(handle, bodies.raw, strong);
    }
    /**
     * The number of soft bodies on this set.
     */
    len() {
        return this.map.len();
    }
    /**
     * Does this set contain a soft body with the given handle?
     */
    contains(handle) {
        return this.get(handle) != null;
    }
    /**
     * Gets the soft body with the given handle.
     */
    get(handle) {
        return this.map.get(handle);
    }
    /**
     * Applies the given closure to each soft body contained by this set.
     */
    forEach(f) {
        this.map.forEach(f);
    }
    /**
     * Gets all soft bodies in the list.
     */
    getAll() {
        return this.map.getAll();
    }
}
//# sourceMappingURL=soft_body_set.js.map