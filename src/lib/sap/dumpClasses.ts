// The ONLY ABAP classes either reader is allowed to execute.
//
// Both are read-only IF_OO_ADT_CLASSRUN dumps that emit JSON and write nothing.
// Running one is a single round trip instead of a dozen freestyle reads, which
// matters on a slow system - the PRPS/PROJ join alone takes ~17s on the sandbox.
//
// The allowlist is the security boundary: classrun executes arbitrary ABAP, so
// the bridge must never relay a caller-supplied class name. Absent classes are
// not an error, just a fall back to the portable freestyle path.

export const ORG_MODEL_DUMP_CLASS = 'ZCL_M12_ORG_MODEL_DUMP'
export const PC_HIERARCHY_DUMP_CLASS = 'ZCL_M12_PC_HIER_DUMP'

export const ORG_DUMP_CLASSES: readonly string[] = [
  ORG_MODEL_DUMP_CLASS,
  PC_HIERARCHY_DUMP_CLASS,
]
