// AUTO-GENERATED SNAPSHOT — SAP Enterprise Data Model (controlling area A000)
// Source: live pull from the connected S/4HANA sandbox (vhcals4hcs, client 100) via the
// SAP-Vibe MCP server, class ZCL_M12_ORG_MODEL_DUMP, on 2026-06-26.
// This is real configuration data, not mock data. Regenerate by re-running the dump class.
import type { SapEnterpriseModel } from './types'

export const SAP_ENTERPRISE_MODEL: SapEnterpriseModel = {
  "source": {
    "system": "vhcals4hcs (S/4HANA CAL sandbox)",
    "client": "100",
    "controllingArea": "A000",
    "pulledOn": "2026-06-26",
    "via": "SAP-Vibe MCP → ZCL_M12_ORG_MODEL_DUMP"
  },
  "controllingArea": {
    "kokrs": "A000",
    "name": "Controlling Area A000",
    "currency": "USD",
    "chart": "YCOA",
    "fiscalVar": "K4"
  },
  "companyCodes": [
    {
      "bukrs": "1710",
      "name": "Company Code 1710",
      "country": "US",
      "currency": "USD",
      "chart": "YCOA",
      "plantCount": 6,
      "profitCenterCount": 18,
      "costCenterCount": 110,
      "wbsRaCount": 142,
      "salesOrgs": [
        "1710",
        "FOBP",
        "FORP"
      ],
      "purchasingOrgs": [
        "1710",
        "FLPO",
        "FOBP",
        "FORP"
      ]
    },
    {
      "bukrs": "1010",
      "name": "Company Code 1010",
      "country": "DE",
      "currency": "EUR",
      "chart": "YCOA",
      "plantCount": 1,
      "profitCenterCount": 1,
      "costCenterCount": 26,
      "wbsRaCount": 2,
      "salesOrgs": [
        "1010"
      ],
      "purchasingOrgs": [
        "1010"
      ]
    },
    {
      "bukrs": "1500",
      "name": "GB Company Code",
      "country": "GB",
      "currency": "GBP",
      "chart": "YCOA",
      "plantCount": 1,
      "profitCenterCount": 18,
      "costCenterCount": 2,
      "wbsRaCount": 2,
      "salesOrgs": [
        "1500"
      ],
      "purchasingOrgs": []
    },
    {
      "bukrs": "5070",
      "name": "Company Code 5070",
      "country": "US",
      "currency": "USD",
      "chart": "YCOA",
      "plantCount": 1,
      "profitCenterCount": 12,
      "costCenterCount": 2,
      "wbsRaCount": 5,
      "salesOrgs": [
        "5070"
      ],
      "purchasingOrgs": []
    },
    {
      "bukrs": "6050",
      "name": "Company Code 6050",
      "country": "US",
      "currency": "USD",
      "chart": "YCOA",
      "plantCount": 1,
      "profitCenterCount": 12,
      "costCenterCount": 3,
      "wbsRaCount": 0,
      "salesOrgs": [
        "6050"
      ],
      "purchasingOrgs": []
    }
  ],
  "plants": [
    {
      "werks": "1010",
      "name": "Plant 1 DE",
      "bukrs": "1010",
      "storageLocations": [
        "0001",
        "101A",
        "101B",
        "101C",
        "101D",
        "101E",
        "101F",
        "101H",
        "101Q",
        "101R",
        "101S",
        "101T",
        "101V"
      ]
    },
    {
      "werks": "1500",
      "name": "Plant 1 GB",
      "bukrs": "1500",
      "storageLocations": []
    },
    {
      "werks": "1710",
      "name": "Plant 1 US",
      "bukrs": "1710",
      "storageLocations": [
        "171A",
        "171B",
        "171C",
        "171D",
        "171E",
        "171F",
        "171H",
        "171Q",
        "171R",
        "171S",
        "171T",
        "171V",
        "VAN1"
      ]
    },
    {
      "werks": "1720",
      "name": "Plant 2 US",
      "bukrs": "1710",
      "storageLocations": [
        "172A"
      ]
    },
    {
      "werks": "2000",
      "name": "MOOG US Plant A",
      "bukrs": "1710",
      "storageLocations": [
        "0001"
      ]
    },
    {
      "werks": "2010",
      "name": "MOOG US Plant B",
      "bukrs": "1710",
      "storageLocations": []
    },
    {
      "werks": "FOBP",
      "name": "Plant 3 US (Base Plant)",
      "bukrs": "1710",
      "storageLocations": [
        "FOBN",
        "FOBW"
      ]
    },
    {
      "werks": "FORP",
      "name": "Plant 2 US (Remote Plant)",
      "bukrs": "1710",
      "storageLocations": [
        "FORN"
      ]
    },
    {
      "werks": "5070",
      "name": "Plant 1 US",
      "bukrs": "5070",
      "storageLocations": []
    },
    {
      "werks": "6050",
      "name": "Plant 1 US",
      "bukrs": "6050",
      "storageLocations": []
    }
  ],
  "salesOrgs": [
    {
      "vkorg": "1010",
      "name": "Dom. Sales Org DE",
      "bukrs": "1010"
    },
    {
      "vkorg": "1500",
      "name": "Fluor Limited UK",
      "bukrs": "1500"
    },
    {
      "vkorg": "1710",
      "name": "Dom. Sales Org US",
      "bukrs": "1710"
    },
    {
      "vkorg": "FOBP",
      "name": "Sales Org. FOBP",
      "bukrs": "1710"
    },
    {
      "vkorg": "FORP",
      "name": "Sales Org. FORP",
      "bukrs": "1710"
    },
    {
      "vkorg": "5070",
      "name": "MX",
      "bukrs": "5070"
    },
    {
      "vkorg": "6050",
      "name": "MD",
      "bukrs": "6050"
    }
  ],
  "purchasingOrgs": [
    {
      "ekorg": "1010",
      "name": "Purch. Org. 1010",
      "bukrs": "1010",
      "plants": [
        "1010"
      ]
    },
    {
      "ekorg": "1710",
      "name": "Purch. Org. 1710",
      "bukrs": "1710",
      "plants": [
        "1710",
        "1720",
        "2000"
      ]
    },
    {
      "ekorg": "FLPO",
      "name": "Purch. Org. FLPO",
      "bukrs": "1710",
      "plants": [
        "FOBP",
        "FORP"
      ]
    },
    {
      "ekorg": "FOBP",
      "name": "Purch. Org. FOBP",
      "bukrs": "1710",
      "plants": [
        "FOBP"
      ]
    },
    {
      "ekorg": "FORP",
      "name": "Purch. Org. FORP",
      "bukrs": "1710",
      "plants": [
        "FORP"
      ]
    }
  ],
  "businessAreas": [
    {
      "gsber": "0001",
      "name": "Business area 0001",
      "used": false
    }
  ],
  "profitCenters": {
    "byCompanyCode": {
      "1010": 1,
      "1500": 18,
      "1710": 18,
      "5070": 12,
      "6050": 12
    },
    "total": 120,
    "sample": [
      {
        "prctr": "0100000001",
        "name": "Home Office"
      },
      {
        "prctr": "0110000001",
        "name": "737 Profit Center"
      },
      {
        "prctr": "0110000002",
        "name": "787 Profit Center"
      },
      {
        "prctr": "0111000001",
        "name": "BCA Group Office"
      },
      {
        "prctr": "0120000001",
        "name": "BDS Group Office"
      },
      {
        "prctr": "0121000001",
        "name": "BDS DIV1 Group Off"
      },
      {
        "prctr": "0121000002",
        "name": "Program A PC"
      },
      {
        "prctr": "0121000003",
        "name": "Program B PC"
      },
      {
        "prctr": "0122000001",
        "name": "BDS DIV2 Group Off"
      },
      {
        "prctr": "0122000002",
        "name": "Program C PC"
      },
      {
        "prctr": "0131000001",
        "name": "BGS Commercial"
      },
      {
        "prctr": "0132000001",
        "name": "BGS Def Group Off"
      },
      {
        "prctr": "0133000001",
        "name": "BGS Def Div1 Grp"
      },
      {
        "prctr": "0133000002",
        "name": "Program C PC"
      },
      {
        "prctr": "QCHECK",
        "name": "Quality Check"
      },
      {
        "prctr": "T-PCB98",
        "name": "Production Logistics"
      }
    ]
  },
  "costCenters": {
    "byCompanyCode": {
      "1010": 26,
      "1500": 2,
      "1710": 110,
      "5070": 2,
      "6050": 3
    },
    "total": 143,
    "sample": [
      {
        "kostl": "12876",
        "name": "Quality - UK",
        "bukrs": "1710",
        "prctr": "0121000001"
      },
      {
        "kostl": "12878",
        "name": "Proj Mgmt-FB",
        "bukrs": "1710",
        "prctr": "0121000001"
      },
      {
        "kostl": "12881",
        "name": "Proj Ctrls-FB",
        "bukrs": "1710",
        "prctr": "0121000001"
      },
      {
        "kostl": "10101101",
        "name": "Financials (DE)",
        "bukrs": "1010",
        "prctr": "YB600"
      },
      {
        "kostl": "10101201",
        "name": "Purch &amp; Store 1 (DE)",
        "bukrs": "1010",
        "prctr": "YB700"
      },
      {
        "kostl": "10101202",
        "name": "Purch &amp; Store 2 (DE)",
        "bukrs": "1010",
        "prctr": "YB700"
      },
      {
        "kostl": "15001303",
        "name": "Con Field Staff",
        "bukrs": "1500",
        "prctr": "YB110"
      },
      {
        "kostl": "15001304",
        "name": "Con Field Staff",
        "bukrs": "1500",
        "prctr": "YB110"
      },
      {
        "kostl": "51000003",
        "name": "BDS Fringe",
        "bukrs": "5070",
        "prctr": "0120000001"
      },
      {
        "kostl": "53000001",
        "name": "BDS Elec Eng",
        "bukrs": "5070",
        "prctr": "0121000002"
      },
      {
        "kostl": "51000004",
        "name": "BGS Fringe",
        "bukrs": "6050",
        "prctr": "0132000001"
      },
      {
        "kostl": "53000000",
        "name": "AuO Engineering",
        "bukrs": "6050",
        "prctr": "0132000001"
      },
      {
        "kostl": "53000002",
        "name": "BGS Elec Eng",
        "bukrs": "6050",
        "prctr": "0133000002"
      }
    ]
  },
  "raKeys": [
    {
      "key": "Y00001",
      "count": 117,
      "levels": {
        "2": 114,
        "3": 3
      },
      "label": "Customer RA key (chart YCOA) — primary revenue-recognition key"
    },
    {
      "key": "000001",
      "count": 24,
      "levels": {
        "1": 22,
        "2": 2
      },
      "label": "SAP standard Results Analysis key"
    },
    {
      "key": "YM1205",
      "count": 6,
      "levels": {
        "1": 2,
        "2": 4
      },
      "label": "Customer RA key (chart YCOA) — Performance Obligation (POB) revenue recognition"
    },
    {
      "key": "Y00005",
      "count": 4,
      "levels": {
        "1": 1,
        "2": 2,
        "3": 1
      },
      "label": "Customer RA key (chart YCOA) — MRO / settlement scenarios"
    }
  ],
  "raByCompanyCode": [
    {
      "bukrs": "1710",
      "count": 142,
      "keys": {
        "Y00001": 108,
        "YM1205": 6,
        "Y00005": 4,
        "000001": 24
      },
      "levels": {
        "L2": 115,
        "L1": 25,
        "L3": 2
      }
    },
    {
      "bukrs": "1010",
      "count": 2,
      "keys": {
        "Y00001": 2
      },
      "levels": {
        "L2": 2
      }
    },
    {
      "bukrs": "1500",
      "count": 2,
      "keys": {
        "Y00001": 2
      },
      "levels": {
        "L2": 1,
        "L3": 1
      }
    },
    {
      "bukrs": "5070",
      "count": 5,
      "keys": {
        "Y00001": 5
      },
      "levels": {
        "L2": 4,
        "L3": 1
      }
    }
  ],
  "raProjects": [
    {
      "project": "U1BW",
      "name": "Umicore Poland Wave3S Blue Wave 1",
      "bukrs": "1710",
      "wbsCount": 28,
      "keys": [
        "Y00001"
      ]
    },
    {
      "project": "UZ1BW",
      "name": "Umicore Wave3S Blue Wave 1 (Contract)",
      "bukrs": "1710",
      "wbsCount": 14,
      "keys": [
        "Y00001"
      ]
    },
    {
      "project": "A0003",
      "name": "Nebula",
      "bukrs": "1710",
      "wbsCount": 7,
      "keys": [
        "Y00001"
      ]
    },
    {
      "project": "A0007",
      "name": "Starship Enterprise",
      "bukrs": "1710",
      "wbsCount": 7,
      "keys": [
        "Y00001"
      ]
    },
    {
      "project": "A0011",
      "name": "Rover Landing",
      "bukrs": "1710",
      "wbsCount": 7,
      "keys": [
        "Y00001"
      ]
    },
    {
      "project": "A0005",
      "name": "FA1234-02-C-8855 - Jan Demo -",
      "bukrs": "1710",
      "wbsCount": 6,
      "keys": [
        "Y00001",
        "YM1205"
      ]
    },
    {
      "project": "H E17800641",
      "name": "UB1F",
      "bukrs": "1710",
      "wbsCount": 6,
      "keys": [
        "Y00001"
      ]
    },
    {
      "project": "U1RY",
      "name": "Fluor Demo Intercompany PoC -",
      "bukrs": "1710",
      "wbsCount": 5,
      "keys": [
        "Y00001"
      ]
    },
    {
      "project": "H E17799200",
      "name": "UB1W",
      "bukrs": "1710",
      "wbsCount": 4,
      "keys": [
        "Y00001"
      ]
    },
    {
      "project": "H E17800026",
      "name": "UB1Z",
      "bukrs": "1710",
      "wbsCount": 4,
      "keys": [
        "Y00001"
      ]
    },
    {
      "project": "U1CM",
      "name": "Fluor Change Management Test",
      "bukrs": "1710",
      "wbsCount": 4,
      "keys": [
        "Y00001"
      ]
    },
    {
      "project": "H F17799200",
      "name": "UB1W",
      "bukrs": "1710",
      "wbsCount": 3,
      "keys": [
        "Y00001"
      ]
    },
    {
      "project": "VMOG-00001",
      "name": "V-MOG Build Project -00001",
      "bukrs": "1710",
      "wbsCount": 3,
      "keys": [
        "Y00001"
      ]
    },
    {
      "project": "D-0026",
      "name": "Inter Segment Processing - 234",
      "bukrs": "5070",
      "wbsCount": 2,
      "keys": [
        "Y00001"
      ]
    },
    {
      "project": "H EFULLTREA",
      "name": "FULL-TREE-A",
      "bukrs": "1710",
      "wbsCount": 2,
      "keys": [
        "Y00001"
      ]
    },
    {
      "project": "M12G",
      "name": "Test C",
      "bukrs": "1710",
      "wbsCount": 2,
      "keys": [
        "000001"
      ]
    },
    {
      "project": "M12H",
      "name": "Moog Demo POC",
      "bukrs": "1710",
      "wbsCount": 2,
      "keys": [
        "000001",
        "YM1205"
      ]
    },
    {
      "project": "M12I",
      "name": "Moog Test Project 1",
      "bukrs": "1710",
      "wbsCount": 2,
      "keys": [
        "000001"
      ]
    },
    {
      "project": "M12J",
      "name": "Moog Demo Day Project 1",
      "bukrs": "1710",
      "wbsCount": 2,
      "keys": [
        "000001",
        "YM1205"
      ]
    },
    {
      "project": "M12K",
      "name": "Moog Demo Day Project 1",
      "bukrs": "1710",
      "wbsCount": 2,
      "keys": [
        "000001",
        "YM1205"
      ]
    },
    {
      "project": "U1RZ",
      "name": "RY - Umicore Pre-Feed Test",
      "bukrs": "1010",
      "wbsCount": 2,
      "keys": [
        "Y00001"
      ]
    },
    {
      "project": "X U1BW",
      "name": "Umicore Wave3S Blue Wave 1 - Execution",
      "bukrs": "1710",
      "wbsCount": 2,
      "keys": [
        "Y00001"
      ]
    },
    {
      "project": "A0020",
      "name": "Project Definition A-0020",
      "bukrs": "1710",
      "wbsCount": 1,
      "keys": [
        "Y00001"
      ]
    },
    {
      "project": "A0111",
      "name": "FA1234-02-C-8855 - Jan Demo -",
      "bukrs": "1710",
      "wbsCount": 1,
      "keys": [
        "Y00005"
      ]
    },
    {
      "project": "A0112",
      "name": "Project Definition A-0112",
      "bukrs": "1710",
      "wbsCount": 1,
      "keys": [
        "Y00005"
      ]
    },
    {
      "project": "A0115",
      "name": "Test MRO Settlement/RA",
      "bukrs": "1710",
      "wbsCount": 1,
      "keys": [
        "Y00005"
      ]
    },
    {
      "project": "D-0002",
      "name": "Project Definition D-0002",
      "bukrs": "1710",
      "wbsCount": 1,
      "keys": [
        "Y00001"
      ]
    },
    {
      "project": "D-0006",
      "name": "Contract VBAT XXXX Accounting Project",
      "bukrs": "1710",
      "wbsCount": 1,
      "keys": [
        "Y00001"
      ]
    },
    {
      "project": "D-0020",
      "name": "Inter Segment Processing - 234",
      "bukrs": "5070",
      "wbsCount": 1,
      "keys": [
        "Y00001"
      ]
    },
    {
      "project": "D-0021",
      "name": "Contract VBAT XXXX Accounting Project",
      "bukrs": "1710",
      "wbsCount": 1,
      "keys": [
        "Y00001"
      ]
    },
    {
      "project": "D-0022",
      "name": "Contract VBAT XXXX Accounting Project",
      "bukrs": "1710",
      "wbsCount": 1,
      "keys": [
        "Y00001"
      ]
    },
    {
      "project": "D-0023",
      "name": "Contract VBAT XXXX Accounting Project",
      "bukrs": "1710",
      "wbsCount": 1,
      "keys": [
        "Y00001"
      ]
    },
    {
      "project": "D-0024",
      "name": "Contract VBAT XXXX Accounting Project",
      "bukrs": "1710",
      "wbsCount": 1,
      "keys": [
        "Y00001"
      ]
    },
    {
      "project": "D-0025",
      "name": "PP TEST 03 - 0123",
      "bukrs": "1710",
      "wbsCount": 1,
      "keys": [
        "Y00001"
      ]
    },
    {
      "project": "D0016",
      "name": "Demo Project 1",
      "bukrs": "1710",
      "wbsCount": 1,
      "keys": [
        "Y00001"
      ]
    },
    {
      "project": "H EASYNC1TS",
      "name": "ASYNC-TEST-1",
      "bukrs": "1710",
      "wbsCount": 1,
      "keys": [
        "Y00001"
      ]
    },
    {
      "project": "H ETREE02TS",
      "name": "TREE-TEST-02",
      "bukrs": "1710",
      "wbsCount": 1,
      "keys": [
        "Y00001"
      ]
    },
    {
      "project": "M12-T1",
      "name": "Mach12 Servovalve Test",
      "bukrs": "1710",
      "wbsCount": 1,
      "keys": [
        "000001"
      ]
    },
    {
      "project": "M120",
      "name": "Test 6",
      "bukrs": "1710",
      "wbsCount": 1,
      "keys": [
        "000001"
      ]
    },
    {
      "project": "M121",
      "name": "M121",
      "bukrs": "1710",
      "wbsCount": 1,
      "keys": [
        "000001"
      ]
    },
    {
      "project": "M122",
      "name": "M122",
      "bukrs": "1710",
      "wbsCount": 1,
      "keys": [
        "000001"
      ]
    },
    {
      "project": "M123",
      "name": "M123",
      "bukrs": "1710",
      "wbsCount": 1,
      "keys": [
        "000001"
      ]
    },
    {
      "project": "M124",
      "name": "M124",
      "bukrs": "1710",
      "wbsCount": 1,
      "keys": [
        "000001"
      ]
    },
    {
      "project": "M125",
      "name": "M125",
      "bukrs": "1710",
      "wbsCount": 1,
      "keys": [
        "000001"
      ]
    },
    {
      "project": "M126",
      "name": "M126",
      "bukrs": "1710",
      "wbsCount": 1,
      "keys": [
        "000001"
      ]
    },
    {
      "project": "M127",
      "name": "Test 6",
      "bukrs": "1710",
      "wbsCount": 1,
      "keys": [
        "000001"
      ]
    },
    {
      "project": "M128",
      "name": "Test 6",
      "bukrs": "1710",
      "wbsCount": 1,
      "keys": [
        "000001"
      ]
    },
    {
      "project": "M129",
      "name": "Test 6",
      "bukrs": "1710",
      "wbsCount": 1,
      "keys": [
        "000001"
      ]
    },
    {
      "project": "M12A",
      "name": "Test 6",
      "bukrs": "1710",
      "wbsCount": 1,
      "keys": [
        "000001"
      ]
    },
    {
      "project": "M12B",
      "name": "Test 6",
      "bukrs": "1710",
      "wbsCount": 1,
      "keys": [
        "000001"
      ]
    },
    {
      "project": "M12C",
      "name": "Test 6",
      "bukrs": "1710",
      "wbsCount": 1,
      "keys": [
        "000001"
      ]
    },
    {
      "project": "M12D",
      "name": "Test 6",
      "bukrs": "1710",
      "wbsCount": 1,
      "keys": [
        "000001"
      ]
    },
    {
      "project": "M12E",
      "name": "Test 6",
      "bukrs": "1710",
      "wbsCount": 1,
      "keys": [
        "YM1205"
      ]
    },
    {
      "project": "M12F",
      "name": "Test 6",
      "bukrs": "1710",
      "wbsCount": 1,
      "keys": [
        "YM1205"
      ]
    },
    {
      "project": "M12T",
      "name": "M12T",
      "bukrs": "1710",
      "wbsCount": 1,
      "keys": [
        "000001"
      ]
    },
    {
      "project": "M12U",
      "name": "M12U",
      "bukrs": "1710",
      "wbsCount": 1,
      "keys": [
        "000001"
      ]
    },
    {
      "project": "WW-BOUSA",
      "name": "Boeing_JDAM_USA Project",
      "bukrs": "1710",
      "wbsCount": 1,
      "keys": [
        "Y00005"
      ]
    }
  ],
  "assignments": [
    {
      "relationship": "Controlling Area → Company Code",
      "via": "TKA02 (assign company code to controlling area)",
      "count": 5,
      "note": "1:N — one CO area spans many company codes; FI/CO integration on (TKA01-KOKFI)"
    },
    {
      "relationship": "Company Code → Plant",
      "via": "T001K (valuation area) → T001W",
      "count": 10,
      "note": "Plant assigned to company code through its valuation area"
    },
    {
      "relationship": "Plant → Storage Location",
      "via": "T001L",
      "count": 31,
      "note": "Inventory-managing sub-locations within a plant"
    },
    {
      "relationship": "Company Code → Sales Organization",
      "via": "TVKO",
      "count": 7,
      "note": "Each sales org posts to exactly one company code"
    },
    {
      "relationship": "Company Code → Purchasing Organization",
      "via": "T024E (+ T024W plant assignment)",
      "count": 5,
      "note": "Purch. org can be company-code-specific or cross-company"
    },
    {
      "relationship": "Controlling Area → Profit Center",
      "via": "CEPC / CEPC_BUKRS (company-code assignment)",
      "count": 120,
      "note": "Profit centers live at CO-area level, assigned to company codes"
    },
    {
      "relationship": "Controlling Area → Cost Center",
      "via": "CSKS (carries BUKRS + PRCTR)",
      "count": 143,
      "note": "Each cost center ties to one company code and one profit center"
    },
    {
      "relationship": "Controlling Area → Business Area",
      "via": "TGSB (global, cross-company)",
      "count": 1,
      "note": "Business areas are client-wide, not company-code-scoped"
    },
    {
      "relationship": "Company Code → Project / WBS",
      "via": "PROJ-VBUKR / PRPS-PBUKR",
      "count": 57,
      "note": "57 projects carry RA-keyed WBS in A000"
    },
    {
      "relationship": "WBS → Revenue Recognition (RA)",
      "via": "PRPS-ABGSL (Results Analysis key)",
      "count": 151,
      "note": "RA key set on the WBS element marks the revenue-recognition / results-analysis level"
    }
  ]
} as const
