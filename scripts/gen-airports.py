# Compact table -> typed TS. Runway figures are reference data; every airport
# carries an AirNav link so the pilot can verify against the Chart Supplement.
# fields: icao, iata, name, city, region, lat, lon, elev, tz, runways
A = [
 ("KCLT","CLT","Charlotte Douglas International","Charlotte","NC",35.2140,-80.9431,748,"America/New_York",
  [("18L/36R",8677,150,180),("18C/36C",10000,150,180),("18R/36L",9000,150,180),("05/23",7502,150,50)]),
 ("KDCA","DCA","Ronald Reagan Washington National","Washington","DC",38.8512,-77.0402,15,"America/New_York",
  [("01/19",7169,150,10),("15/33",5204,150,150),("04/22",5000,150,40)]),
 ("KDAY","DAY","Dayton International","Dayton","OH",39.9024,-84.2194,1009,"America/New_York",
  [("06L/24R",10901,150,60),("06R/24L",8500,150,60)]),
 ("KPHL","PHL","Philadelphia International","Philadelphia","PA",39.8719,-75.2411,36,"America/New_York",
  [("09L/27R",10506,200,90),("09R/27L",9500,150,90),("08/26",5000,150,80),("17/35",6500,150,170)]),
 ("KORF","ORF","Norfolk International","Norfolk","VA",36.8946,-76.2012,26,"America/New_York",
  [("05/23",9001,150,50),("14/32",4875,150,140)]),
 ("KTYS","TYS","McGhee Tyson","Knoxville","TN",35.8110,-83.9940,981,"America/New_York",
  [("05L/23R",9009,150,50),("05R/23L",9005,150,50)]),
 ("KRIC","RIC","Richmond International","Richmond","VA",37.5052,-77.3197,167,"America/New_York",
  [("16/34",9003,150,160),("02/20",6607,150,20),("07/25",5326,150,70)]),
 ("KGSO","GSO","Piedmont Triad International","Greensboro","NC",36.0977,-79.9373,925,"America/New_York",
  [("05L/23R",10001,150,50),("05R/23L",9000,150,50),("14/32",6380,150,140)]),
 ("KCHS","CHS","Charleston International","Charleston","SC",32.8986,-80.0405,46,"America/New_York",
  [("15/33",9001,150,150),("03/21",7000,150,30)]),
 ("KSAV","SAV","Savannah/Hilton Head International","Savannah","GA",32.1276,-81.2021,50,"America/New_York",
  [("10/28",9351,150,100),("01/19",7002,150,10)]),
 ("KAVL","AVL","Asheville Regional","Asheville","NC",35.4362,-82.5418,2165,"America/New_York",
  [("17/35",8001,150,170)]),
 ("KCAE","CAE","Columbia Metropolitan","Columbia","SC",33.9388,-81.1195,236,"America/New_York",
  [("11/29",8601,150,110),("05/23",8001,150,50)]),
 ("KILM","ILM","Wilmington International","Wilmington","NC",34.2706,-77.9026,32,"America/New_York",
  [("06/24",8016,150,60),("17/35",7004,150,170)]),
 ("KROA","ROA","Roanoke-Blacksburg Regional","Roanoke","VA",37.3255,-79.9754,1176,"America/New_York",
  [("06/24",6802,150,60),("15/33",5810,150,150)]),
 ("KCHA","CHA","Chattanooga Metropolitan","Chattanooga","TN",35.0353,-85.2038,683,"America/New_York",
  [("02/20",7401,150,20),("15/33",5000,150,150)]),
 ("KTRI","TRI","Tri-Cities","Blountville","TN",36.4752,-82.4074,1519,"America/New_York",
  [("05/23",8000,150,50),("09/27",4447,150,90)]),
 ("KBNA","BNA","Nashville International","Nashville","TN",36.1245,-86.6782,599,"America/Chicago",
  [("02L/20R",8000,150,20),("02C/20C",11030,150,20),("02R/20L",9000,150,20),("13/31",8000,150,130)]),
 ("KIND","IND","Indianapolis International","Indianapolis","IN",39.7173,-86.2944,797,"America/Indiana/Indianapolis",
  [("05L/23R",11200,150,50),("05R/23L",10000,150,50),("14/32",7280,150,140)]),
 ("KCVG","CVG","Cincinnati/Northern Kentucky International","Hebron","KY",39.0488,-84.6678,896,"America/New_York",
  [("18L/36R",12000,150,180),("18C/36C",11000,150,180),("18R/36L",8000,150,180),("09/27",11000,150,90)]),
 ("KCMH","CMH","John Glenn Columbus International","Columbus","OH",39.9980,-82.8919,815,"America/New_York",
  [("10L/28R",10125,150,100),("10R/28L",8000,150,100)]),
 ("KPIT","PIT","Pittsburgh International","Pittsburgh","PA",40.4915,-80.2329,1203,"America/New_York",
  [("10C/28C",10502,150,100),("10L/28R",9708,150,100),("10R/28L",11500,200,100),("14/32",8101,150,140)]),
 ("KIAD","IAD","Washington Dulles International","Dulles","VA",38.9531,-77.4565,313,"America/New_York",
  [("01L/19R",11500,150,10),("01C/19C",11500,150,10),("01R/19L",9400,150,10),("12/30",10501,150,120)]),
 ("KBWI","BWI","Baltimore/Washington International Thurgood Marshall","Baltimore","MD",39.1754,-76.6683,146,"America/New_York",
  [("10/28",10502,200,100),("15R/33L",9501,200,150),("15L/33R",5000,100,150),("04/22",6000,150,40)]),
 ("KBOS","BOS","Boston Logan International","Boston","MA",42.3656,-71.0096,20,"America/New_York",
  [("04L/22R",7861,150,40),("04R/22L",10083,150,40),("09/27",7000,150,90),("15R/33L",10006,150,150),("15L/33R",2557,100,150),("14/32",5000,100,140)]),
 ("KLGA","LGA","LaGuardia","New York","NY",40.7769,-73.8740,21,"America/New_York",
  [("04/22",7003,150,40),("13/31",7003,150,130)]),
 ("KJFK","JFK","John F. Kennedy International","New York","NY",40.6413,-73.7781,13,"America/New_York",
  [("04L/22R",12079,200,40),("04R/22L",8400,200,40),("13L/31R",10000,200,130),("13R/31L",14511,200,130)]),
 ("KEWR","EWR","Newark Liberty International","Newark","NJ",40.6895,-74.1745,18,"America/New_York",
  [("04L/22R",11000,150,40),("04R/22L",10000,150,40),("11/29",6800,150,110)]),
 ("KORD","ORD","Chicago O'Hare International","Chicago","IL",41.9786,-87.9048,672,"America/Chicago",
  [("10L/28R",13000,200,100),("09C/27C",11245,200,90),("10C/28C",10801,200,100),("09L/27R",7967,150,90),("09R/27L",7500,150,90),("10R/28L",7500,150,100),("04L/22R",7500,150,40)]),
 ("KDFW","DFW","Dallas/Fort Worth International","Dallas","TX",32.8998,-97.0403,607,"America/Chicago",
  [("17R/35L",13401,200,170),("17C/35C",13401,200,170),("18L/36R",13400,200,180),("18R/36L",13401,200,180),("13R/31L",9000,200,130),("13L/31R",9301,200,130),("17L/35R",8500,150,170)]),
 ("KMIA","MIA","Miami International","Miami","FL",25.7959,-80.2870,8,"America/New_York",
  [("08L/26R",8600,150,80),("08R/26L",10506,200,80),("09/27",13016,150,90),("12/30",9355,150,120)]),
 ("KPHX","PHX","Phoenix Sky Harbor International","Phoenix","AZ",33.4342,-112.0116,1135,"America/Phoenix",
  [("07L/25R",10300,150,70),("07R/25L",7800,150,70),("08/26",11489,150,80)]),
 ("KATL","ATL","Hartsfield-Jackson Atlanta International","Atlanta","GA",33.6407,-84.4277,1026,"America/New_York",
  [("08L/26R",9000,150,80),("08R/26L",10000,150,80),("09L/27R",12390,150,90),("09R/27L",9000,150,90),("10/28",9000,150,100)]),
 ("KDTW","DTW","Detroit Metropolitan Wayne County","Detroit","MI",42.2124,-83.3534,645,"America/Detroit",
  [("04L/22R",12003,200,40),("04R/22L",10000,150,40),("03L/21R",10000,150,30),("03R/21L",8500,200,30),("09L/27R",8708,150,90),("09R/27L",8500,150,90)]),
 ("KMSP","MSP","Minneapolis-St Paul International","Minneapolis","MN",44.8848,-93.2223,841,"America/Chicago",
  [("12L/30R",8200,150,120),("12R/30L",11006,200,120),("04/22",11000,200,40),("17/35",8000,150,170)]),
 ("KRDU","RDU","Raleigh-Durham International","Raleigh","NC",35.8776,-78.7875,435,"America/New_York",
  [("05L/23R",10000,150,50),("05R/23L",7500,150,50)]),
 ("KGSP","GSP","Greenville-Spartanburg International","Greer","SC",34.8957,-82.2189,964,"America/New_York",
  [("04/22",11001,150,40)]),
 ("KSDF","SDF","Louisville Muhammad Ali International","Louisville","KY",38.1744,-85.7360,501,"America/Kentucky/Louisville",
  [("17R/35L",11890,200,170),("17L/35R",8579,150,170),("11/29",7250,150,110)]),
 ("KMEM","MEM","Memphis International","Memphis","TN",35.0424,-89.9767,341,"America/Chicago",
  [("18L/36R",9000,150,180),("18C/36C",11120,150,180),("18R/36L",9320,150,180),("09/27",8946,150,90)]),
 ("KJAX","JAX","Jacksonville International","Jacksonville","FL",30.4941,-81.6879,30,"America/New_York",
  [("08/26",10000,150,80),("14/32",7701,150,140)]),
 ("KMCO","MCO","Orlando International","Orlando","FL",28.4312,-81.3081,96,"America/New_York",
  [("17L/35R",12005,200,170),("17R/35L",12004,200,170),("18L/36R",9000,200,180),("18R/36L",12005,200,180)]),
 ("KTPA","TPA","Tampa International","Tampa","FL",27.9755,-82.5332,26,"America/New_York",
  [("01L/19R",11002,150,10),("01R/19L",8300,150,10),("10/28",6999,150,100)]),
 ("KMSY","MSY","Louis Armstrong New Orleans International","New Orleans","LA",29.9934,-90.2581,4,"America/Chicago",
  [("11/29",10104,150,110),("02/20",7001,150,20)]),
 ("KBHM","BHM","Birmingham-Shuttlesworth International","Birmingham","AL",33.5629,-86.7535,650,"America/Chicago",
  [("06/24",12002,150,60),("18/36",7100,150,180)]),
 ("KHSV","HSV","Huntsville International","Huntsville","AL",34.6372,-86.7751,629,"America/Chicago",
  [("18L/36R",12600,150,180),("18R/36L",10000,150,180)]),
 ("KBUF","BUF","Buffalo Niagara International","Buffalo","NY",42.9405,-78.7322,728,"America/New_York",
  [("05/23",8829,150,50),("14/32",7161,150,140)]),
 ("KROC","ROC","Frederick Douglass Greater Rochester International","Rochester","NY",43.1189,-77.6724,559,"America/New_York",
  [("04/22",8001,150,40),("10/28",5500,150,100)]),
 ("KSYR","SYR","Syracuse Hancock International","Syracuse","NY",43.1112,-76.1063,421,"America/New_York",
  [("10/28",9003,150,100),("15/33",7500,150,150)]),
 ("KALB","ALB","Albany International","Albany","NY",42.7483,-73.8017,285,"America/New_York",
  [("01/19",7200,150,10),("10/28",5999,150,100)]),
 ("KPVD","PVD","Rhode Island T. F. Green International","Providence","RI",41.7240,-71.4283,55,"America/New_York",
  [("05/23",8700,150,50),("16/34",6081,150,160)]),
 ("KPWM","PWM","Portland International Jetport","Portland","ME",43.6462,-70.3093,76,"America/New_York",
  [("11/29",7200,150,110),("18/36",6000,150,180)]),
 ("KBTV","BTV","Burlington International","Burlington","VT",44.4720,-73.1533,335,"America/New_York",
  [("15/33",8320,150,150),("01/19",4113,75,10)]),
 ("KMHT","MHT","Manchester-Boston Regional","Manchester","NH",42.9326,-71.4357,266,"America/New_York",
  [("06/24",9250,150,60),("17/35",7001,150,170)]),
 ("KGRR","GRR","Gerald R. Ford International","Grand Rapids","MI",42.8808,-85.5228,794,"America/Detroit",
  [("08L/26R",10000,150,80),("08R/26L",5000,150,80),("17/35",6350,150,170)]),
 ("KMKE","MKE","Milwaukee Mitchell International","Milwaukee","WI",42.9472,-87.8966,723,"America/Chicago",
  [("01L/19R",9690,200,10),("07R/25L",8012,150,70),("01R/19L",4183,75,10),("07L/25R",4800,150,70)]),
 ("KSTL","STL","St. Louis Lambert International","St. Louis","MO",38.7487,-90.3700,618,"America/Chicago",
  [("12R/30L",11019,200,120),("12L/30R",9003,150,120),("11/29",9000,150,110),("06/24",7607,150,60)]),
]

NOTES = {
 "KCLT":["American's second-largest hub and PSA's largest crew base; the airfield runs three parallel north-south runways plus a crossing 05/23.",
         "The atrium rocking chairs in Concourse B/C are a Charlotte institution and a genuinely good place to kill a 90-minute sit."],
 "KDCA":["Operates under a perimeter rule and some of the most geographically constrained airspace in the country.",
         "The River Visual to Runway 19 follows the Potomac to stay clear of prohibited airspace over central Washington — one of the most recognisable approaches in the US."],
 "KDAY":["PSA Airlines is headquartered in Dayton.",
         "Dayton is the hometown of the Wright brothers; the National Museum of the US Air Force sits next door at Wright-Patterson AFB."],
 "KPHL":["Second-largest American hub on the East Coast and a major PSA station.",
         "Runway 17/35 crosses the parallels and is often used for general aviation and shorter regional operations."],
 "KORF":["Shares the region with Naval Station Norfolk, the largest naval base in the world — expect military traffic.",
         "The Norfolk Botanical Garden wraps around the airport property."],
 "KTYS":["Two parallel 9,000 ft runways at nearly 1,000 ft elevation in the Tennessee Valley.",
         "Shares the field with the 134th Air Refueling Wing, Tennessee ANG."],
 "KAVL":["At 2,165 ft, the highest-elevation field in this dataset's southeast group — density altitude is a real planning item in summer."],
 "KBOS":["Six runways in a compact footprint on Boston Harbor; runway configuration changes with wind and noise abatement."],
 "KLGA":["Two 7,000 ft runways that cross, with water at both ends — no room for error and no room to grow."],
 "KDFW":["Seven runways, five of them parallel north-south; the field is larger than the island of Manhattan."],
 "KPHX":["Arizona does not observe daylight saving time, so Phoenix's offset to the East Coast shifts by an hour twice a year.",
         "Summer density altitude routinely exceeds 4,000 ft — a genuine performance consideration."],
 "KIND":["Indiana observes Eastern Time with DST; historically it did not, which still trips up schedule reading."],
 "KPIT":["Built as a US Airways megahub; the airside terminal's X-shape is a relic of that era."],
 "KCVG":["A major cargo hub; overnight movements are dominated by freight."],
 "KIAD":["Home of the Steven F. Udvar-Hazy Center, the Smithsonian annex holding Space Shuttle Discovery, an SR-71 and a Concorde.",
         "Eero Saarinen's terminal is a listed piece of mid-century architecture; the mobile lounges that serve it are a Dulles peculiarity."],
 "KMEM":["FedEx's world hub — the overnight sort is one of the largest scheduled operations anywhere."],
}
SPOT = {
 "KCLT":"The overlook off Old Dowd Road on the west side sits under the 18L/36R approach.",
 "KDCA":"Gravelly Point, immediately off the Runway 19 threshold, is one of the most famous spotting locations in the world.",
 "KDAY":"The National Museum of the US Air Force at Wright-Patterson is 20 minutes away and free.",
 "KPHL":"The Bartram's Garden side offers distant views; the terminal's A-West windows are better.",
 "KBOS":"The Harborwalk near Constitution Beach in East Boston sits under the 22L approach.",
 "KIAD":"The Udvar-Hazy Center's observation tower overlooks the airfield — a museum and a spotting deck in one.",
}

def ts_rwy(r):
    ident,length,width,hdg = r
    return ('      { ident: %r, lengthFt: %d, widthFt: %d, surface: %r, headingDeg: %d },'
            % (ident,length,width,'Asphalt/Concrete',hdg)).replace("'",'"')

out = []
out.append('''/**
 * Curated airport reference data.
 *
 * REFERENCE ONLY. Runway dimensions, elevations and surfaces are transcribed
 * from public sources and are not a substitute for the FAA Chart Supplement,
 * NOTAMs, or company charts. Every airport links out to AirNav and the FAA so
 * the pilot can verify against the real thing in one tap.
 */

import type { Airport } from '../core/types';

export const AIRPORTS: Airport[] = [''')

for icao,iata,name,city,region,lat,lon,elev,tz,rwys in A:
    out.append('  {')
    out.append('    icao: "%s",' % icao)
    out.append('    iata: "%s",' % iata)
    out.append('    name: %s,' % ('"%s"' % name.replace('"','\\"')))
    out.append('    city: "%s",' % city)
    out.append('    region: "%s",' % region)
    out.append('    country: "US",')
    out.append('    pos: { lat: %s, lon: %s },' % (lat, lon))
    out.append('    elevationFt: %d,' % elev)
    out.append('    tz: "%s",' % tz)
    out.append('    runways: [')
    for r in rwys:
        out.append(ts_rwy(r))
    out.append('    ],')
    notes = NOTES.get(icao)
    if notes:
        out.append('    notes: [')
        for n in notes:
            out.append('      %s,' % ('"%s"' % n.replace('"','\\"')))
        out.append('    ],')
    sp = SPOT.get(icao)
    if sp:
        out.append('    spotting: %s,' % ('"%s"' % sp.replace('"','\\"')))
    out.append('    sources: [')
    out.append('      { name: "AirNav %s", url: "https://www.airnav.com/airport/%s", kind: "reference" },' % (icao, icao))
    out.append('      { name: "FAA Chart Supplement", url: "https://www.faa.gov/air_traffic/flight_info/aeronav/digital_products/dafd/", kind: "official" },')
    out.append('    ],')
    out.append('  },')

out.append('];')
out.append('')
open('src/data/airports.ts','w').write('\n'.join(out)+'\n')
print("airports:", len(A))
