import { VectorOps } from "../math.js";
/**
 * The result of a shape-cast between two shapes, returned by the pairwise casts
 * `Shape.castShape` and `Collider.castShape`.
 *
 * The first shape is the one the cast is called on (the shape or collider `this`), and the
 * second shape is the `shape2` argument. Each witness point and normal is expressed in the
 * local-space of its own shape, i.e., relative to that shape's pose (it does not depend on
 * the shape's translation along the cast).
 */
export class ShapeCastHit {
    constructor(time_of_impact, witness1, witness2, normal1, normal2) {
        this.time_of_impact = time_of_impact;
        this.witness1 = witness1;
        this.witness2 = witness2;
        this.normal1 = normal1;
        this.normal2 = normal2;
    }
    static fromBuffer(collider, buffer, target) {
        if (!buffer)
            return null;
        target !== null && target !== void 0 ? target : (target = new ShapeCastHit(0, VectorOps.zeros(), VectorOps.zeros(), VectorOps.zeros(), VectorOps.zeros()));
        target.time_of_impact = buffer[0];
        // #if DIM3
        target.witness1.x = buffer[1];
        target.witness1.y = buffer[2];
        target.witness1.z = buffer[3];
        target.witness2.x = buffer[4];
        target.witness2.y = buffer[5];
        target.witness2.z = buffer[6];
        target.normal1.x = buffer[7];
        target.normal1.y = buffer[8];
        target.normal1.z = buffer[9];
        target.normal2.x = buffer[10];
        target.normal2.y = buffer[11];
        target.normal2.z = buffer[12];
        // #endif
        return target;
    }
}
/**
 * The result of a shape-cast that hit a collider.
 *
 * The frames of the witness points and normals depend on the query that returned it:
 * - `World.castShape` (and `BroadPhase.castShape`): `witness1` and `normal1` lie on the hit
 *   `collider` and are expressed in world-space; `witness2` and `normal2` lie on the cast
 *   shape and are expressed in its local-space (relative to its pose, so they do not depend
 *   on its translation along the cast).
 * - `Collider.castCollider`: `witness1` and `normal1` lie on the collider the cast is called
 *   on and are expressed in its local-space; `witness2` and `normal2` lie on the hit
 *   `collider` (the `collider2` argument) and are expressed in its local-space.
 */
export class ColliderShapeCastHit extends ShapeCastHit {
    constructor(collider, time_of_impact, witness1, witness2, normal1, normal2) {
        super(time_of_impact, witness1, witness2, normal1, normal2);
        this.collider = collider;
    }
    static fromBuffer(collider, buffer, target) {
        if (!buffer)
            return null;
        target !== null && target !== void 0 ? target : (target = new ColliderShapeCastHit(null, 0, VectorOps.zeros(), VectorOps.zeros(), VectorOps.zeros(), VectorOps.zeros()));
        target.collider = collider;
        target.time_of_impact = buffer[0];
        // #if DIM3
        target.witness1.x = buffer[1];
        target.witness1.y = buffer[2];
        target.witness1.z = buffer[3];
        target.witness2.x = buffer[4];
        target.witness2.y = buffer[5];
        target.witness2.z = buffer[6];
        target.normal1.x = buffer[7];
        target.normal1.y = buffer[8];
        target.normal1.z = buffer[9];
        target.normal2.x = buffer[10];
        target.normal2.y = buffer[11];
        target.normal2.z = buffer[12];
        // #endif
        return target;
    }
}
//# sourceMappingURL=toi.js.map