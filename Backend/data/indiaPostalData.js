/**
 * Backend India Postal Hierarchy Reference (Source: indiapostal.in / India Post Circles)
 */

const INDIA_POSTAL_DATA = {
  'Tamil Nadu': {
    code: 'TN',
    districts: {
      'Salem': {
        code: 'SLM',
        divisions: {
          'Salem': [
            '636001', '636002', '636003', '636004', '636005', '636006',
            '636007', '636008', '636009', '636010', '636014', '636015',
            '636016', '636112', '636201', '636302', '636401', '636451'
          ],
          'Attur': [
            '636101', '636102', '636107', '636108', '636109', '636111',
            '636113', '636114', '636115', '636117', '636119', '636141',
            '636142'
          ],
          'Mettur': [
            '636402', '636403', '636452', '636455', '636456', '636501',
            '636502', '636503'
          ],
          'Sankari': ['637301', '637302', '637303']
        }
      },
      'Chennai': {
        code: 'CHN',
        divisions: {
          'Chennai City Central': ['600001', '600002', '600003', '600006', '600014'],
          'Chennai City North': ['600004', '600011', '600012', '600013', '600021'],
          'Chennai City South': ['600017', '600018', '600020', '600028', '600041'],
          'Tambaram Division': ['600045', '600047', '600059', '600073', '600096']
        }
      },
      'Coimbatore': {
        code: 'CBE',
        divisions: {
          'Coimbatore Central': ['641001', '641002', '641018', '641027'],
          'Coimbatore North': ['641004', '641006', '641030', '641044'],
          'Coimbatore South': ['641008', '641012', '641021', '641023'],
          'Pollachi': ['642001', '642002', '642109', '642128']
        }
      },
      'Krishnagiri': {
        code: 'KGI',
        divisions: {
          'Krishnagiri Division': ['635001', '635002', '635101', '635112'],
          'Hosur Division': ['635109', '635110', '635115', '635126'],
          'Pochampalli': ['635201', '635206', '635306'],
          'Uthangarai': ['635207', '635304', '635307']
        }
      },
      'Dharmapuri': {
        code: 'DPI',
        divisions: {
          'Dharmapuri Division': ['636701', '636702', '636705', '636807'],
          'Harur Division': ['636903', '636904', '636906'],
          'Palacode': ['636808', '636809', '636811'],
          'Pennagaram': ['636810', '636812', '636813']
        }
      },
      'Madurai': {
        code: 'MDU',
        divisions: {
          'Madurai Division': ['625001', '625002', '625003', '625009', '625020'],
          'Tirumangalam Division': ['625706', '625707', '625708'],
          'Melur Division': ['625106', '625107', '625108']
        }
      },
      'Tiruchirappalli': {
        code: 'TRY',
        divisions: {
          'Tiruchirappalli Division': ['620001', '620002', '620017', '620020'],
          'Srirangam Division': ['620005', '620006', '620027'],
          'Lalgudi Division': ['621601', '621703']
        }
      },
      'Erode': {
        code: 'ERD',
        divisions: {
          'Erode Division': ['638001', '638002', '638009', '638011'],
          'Gobichettipalayam': ['638452', '638453', '638476']
        }
      },
      'Tiruppur': {
        code: 'TPR',
        divisions: {
          'Tiruppur Division': ['641601', '641602', '641604', '641607'],
          'Dharapuram Division': ['638656', '638657', '638701']
        }
      },
      'Vellore': {
        code: 'VEL',
        divisions: {
          'Vellore Division': ['632001', '632004', '632009', '632014'],
          'Katpadi Division': ['632006', '632007', '632059']
        }
      },
      'Kanchipuram': {
        code: 'KPM',
        divisions: {
          'Kanchipuram Division': ['631501', '631502', '631551'],
          'Sriperumbudur': ['602105', '602106']
        }
      },
      'Chengalpattu': {
        code: 'CGL',
        divisions: {
          'Chengalpattu Division': ['603001', '603002', '603003'],
          'Tambaram South': ['600045', '600059']
        }
      },
      'Tirunelveli': {
        code: 'TNV',
        divisions: {
          'Tirunelveli Division': ['627001', '627002', '627005'],
          'Ambasamudram': ['627401', '627413']
        }
      },
      'Thanjavur': {
        code: 'TNJ',
        divisions: {
          'Thanjavur Division': ['613001', '613005', '613007'],
          'Kumbakonam Division': ['612001', '612002']
        }
      },
      'Cuddalore': {
        code: 'CDL',
        divisions: {
          'Cuddalore Division': ['607001', '607002', '607003'],
          'Chidambaram': ['608001', '608002']
        }
      },
      'Namakkal': {
        code: 'NMK',
        divisions: {
          'Namakkal Division': ['637001', '637002', '637003'],
          'Rasipuram Division': ['637408', '637409']
        }
      },
      'Dindigul': {
        code: 'DGL',
        divisions: {
          'Dindigul Division': ['624001', '624003', '624005'],
          'Palani Division': ['624601', '624602']
        }
      },
      'Nilgiris': {
        code: 'NIL',
        divisions: {
          'Udhagamandalam (Ooty)': ['643001', '643002'],
          'Coonoor Division': ['643101', '643102']
        }
      },
      'Kanyakumari': {
        code: 'KKI',
        divisions: {
          'Nagercoil Division': ['629001', '629002'],
          'Thuckalay Division': ['629175', '629176']
        }
      },
      'Theni': {
        code: 'THN',
        divisions: {
          'Theni Division': ['625531', '625534'],
          'Periyakulam': ['625601', '625602']
        }
      },
      'Thoothukudi': {
        code: 'THO',
        divisions: {
          'Tuticorin Division': ['628001', '628002'],
          'Kovilpatti Division': ['628501', '628502']
        }
      },
      'Ramanathapuram': {
        code: 'RMD',
        divisions: {
          'Ramanathapuram Division': ['623501', '623502'],
          'Rameswaram': ['623526', '623529']
        }
      },
      'Sivaganga': {
        code: 'SVG',
        divisions: {
          'Sivaganga Division': ['630561', '630562'],
          'Karaikudi Division': ['630001', '630002']
        }
      },
      'Pudukkottai': {
        code: 'PUD',
        divisions: {
          'Pudukkottai Division': ['622001', '622002'],
          'Aranthangi': ['614616', '614617']
        }
      },
      'Nagapattinam': {
        code: 'NGP',
        divisions: {
          'Nagapattinam Division': ['611001', '611002']
        }
      },
      'Mayiladuthurai': {
        code: 'MYD',
        divisions: {
          'Mayiladuthurai Division': ['609001', '609002']
        }
      },
      'Karur': {
        code: 'KRR',
        divisions: {
          'Karur Division': ['639001', '639002']
        }
      },
      'Perambalur': {
        code: 'PBL',
        divisions: {
          'Perambalur Division': ['621212', '621213']
        }
      },
      'Ariyalur': {
        code: 'ARI',
        divisions: {
          'Ariyalur Division': ['621704', '621705']
        }
      },
      'Tiruvannamalai': {
        code: 'TVM',
        divisions: {
          'Tiruvannamalai Division': ['606601', '606602'],
          'Polur Division': ['606803', '606804']
        }
      },
      'Viluppuram': {
        code: 'VPM',
        divisions: {
          'Villupuram Division': ['605602', '605603'],
          'Tindivanam': ['604001', '604002']
        }
      },
      'Kallakurichi': {
        code: 'KLK',
        divisions: {
          'Kallakurichi Division': ['606202', '606206']
        }
      },
      'Tiruvallur': {
        code: 'TLR',
        divisions: {
          'Tiruvallur Division': ['602001', '602002'],
          'Poonamallee': ['600056', '600077']
        }
      },
      'Ranipet': {
        code: 'RPT',
        divisions: {
          'Ranipet Division': ['632401', '632402'],
          'Arakkonam': ['631001', '631002']
        }
      },
      'Tirupathur': {
        code: 'TPR',
        divisions: {
          'Tirupathur Division': ['635601', '635602'],
          'Vaniyambadi': ['635751', '635752']
        }
      },
      'Tenkasi': {
        code: 'TKS',
        divisions: {
          'Tenkasi Division': ['627811', '627812']
        }
      },
      'Tiruvarur': {
        code: 'TVR',
        divisions: {
          'Tiruvarur Division': ['610001', '610002']
        }
      },
      'Virudhunagar': {
        code: 'VDN',
        divisions: {
          'Virudhunagar Division': ['626001', '626002'],
          'Sivakasi': ['626123', '626124']
        }
      }
    }
  },
  'Karnataka': {
    code: 'KA',
    districts: {
      'Bengaluru Urban': {
        code: 'BLR',
        divisions: {
          'Bengaluru East': ['560001', '560008', '560016', '560025'],
          'Bengaluru West': ['560002', '560003', '560010', '560020'],
          'Bengaluru South': ['560004', '560011', '560029', '560034'],
          'Bengaluru North': ['560005', '560024', '560032', '560064']
        }
      },
      'Mysuru': {
        code: 'MYS',
        divisions: {
          'Mysuru City': ['570001', '570004', '570008', '570020'],
          'Nanjangud': ['571301', '571302']
        }
      },
      'Dakshina Kannada': {
        code: 'DKA',
        divisions: {
          'Mangaluru City': ['575001', '575002', '575003'],
          'Puttur': ['574201', '574202']
        }
      }
    }
  }
};

const ALL_INDIAN_STATES = [
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh', 'Goa',
  'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka', 'Kerala',
  'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram', 'Nagaland',
  'Odisha', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura',
  'Uttar Pradesh', 'Uttarakhand', 'West Bengal', 'Andaman and Nicobar Islands',
  'Chandigarh', 'Dadra and Nagar Haveli and Daman and Diu', 'Delhi',
  'Jammu and Kashmir', 'Ladakh', 'Lakshadweep', 'Puducherry'
];

function getDistrictsForState(stateName) {
  if (!stateName) return [];
  const stateData = INDIA_POSTAL_DATA[stateName];
  if (stateData && stateData.districts) {
    return Object.keys(stateData.districts).sort();
  }
  return ['Central District', 'North District', 'South District', 'East District', 'West District'];
}

function getDivisionsForDistrict(stateName, districtName) {
  if (!stateName || !districtName) return [];
  const stateData = INDIA_POSTAL_DATA[stateName];
  if (stateData?.districts?.[districtName]?.divisions) {
    return Object.keys(stateData.districts[districtName].divisions).sort();
  }
  return [`${districtName} Central`, `${districtName} North`, `${districtName} South`];
}

function getPincodesForDivision(stateName, districtName, divisionName) {
  if (!stateName || !districtName || !divisionName) return [];
  const sKey = Object.keys(INDIA_POSTAL_DATA).find(k => k.toLowerCase() === stateName.trim().toLowerCase()) || stateName;
  const stateData = INDIA_POSTAL_DATA[sKey];
  if (!stateData?.districts) return [];

  const dKey = Object.keys(stateData.districts).find(k => k.toLowerCase() === districtName.trim().toLowerCase()) || districtName;
  const distData = stateData.districts[dKey];
  if (!distData?.divisions) return [];

  const divClean = divisionName.trim().toLowerCase().replace(/\s+division$/, '');
  const divKey = Object.keys(distData.divisions).find(k =>
    k.toLowerCase() === divisionName.trim().toLowerCase() ||
    k.toLowerCase().replace(/\s+division$/, '') === divClean
  ) || divisionName;

  return distData.divisions[divKey] || [];
}

module.exports = {
  INDIA_POSTAL_DATA,
  ALL_INDIAN_STATES,
  getDistrictsForState,
  getDivisionsForDistrict,
  getPincodesForDivision
};
