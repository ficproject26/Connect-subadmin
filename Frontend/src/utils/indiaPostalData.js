/**
 * India Postal Hierarchy Reference Data (Source Reference: indiapostal.in / India Post Circles)
 * Standard Hierarchy:
 * State (Postal Circle) -> District (Postal Region/District) -> Division (Postal Division) -> Pincode (6-digit PIN)
 */

export const INDIA_POSTAL_DATA = {
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
          'Melur Division': ['625106', '625107', '625108'],
          'Usilampatti': ['625532', '625537', '625566']
        }
      },
      'Tiruchirappalli': {
        code: 'TRY',
        divisions: {
          'Tiruchirappalli Division': ['620001', '620002', '620017', '620020'],
          'Srirangam Division': ['620005', '620006', '620027'],
          'Lalgudi Division': ['621601', '621703', '621711'],
          'Manapparai': ['621306', '621307', '621312']
        }
      },
      'Erode': {
        code: 'ERD',
        divisions: {
          'Erode Division': ['638001', '638002', '638009', '638011'],
          'Gobichettipalayam': ['638452', '638453', '638476'],
          'Bhavani': ['638301', '638316', '638382'],
          'Perundurai': ['638052', '638053', '638056']
        }
      },
      'Tiruppur': {
        code: 'TPR',
        divisions: {
          'Tiruppur Division': ['641601', '641602', '641604', '641607'],
          'Dharapuram Division': ['638656', '638657', '638701'],
          'Udumalaipettai': ['642126', '642128', '642154'],
          'Avinashi': ['641654', '641655', '641663']
        }
      },
      'Vellore': {
        code: 'VEL',
        divisions: {
          'Vellore Division': ['632001', '632004', '632009', '632014'],
          'Katpadi Division': ['632006', '632007', '632059'],
          'Gudiyatham': ['632602', '632604', '632801']
        }
      },
      'Kanchipuram': {
        code: 'KPM',
        divisions: {
          'Kanchipuram Division': ['631501', '631502', '631551', '631561'],
          'Sriperumbudur': ['602105', '602106', '602107'],
          'Walajabad': ['631605', '631606']
        }
      },
      'Chengalpattu': {
        code: 'CGL',
        divisions: {
          'Chengalpattu Division': ['603001', '603002', '603003'],
          'Tambaram South': ['600045', '600059', '600073'],
          'Maduranthakam': ['603306', '603307', '603310']
        }
      },
      'Tirunelveli': {
        code: 'TNV',
        divisions: {
          'Tirunelveli Division': ['627001', '627002', '627005', '627006'],
          'Ambasamudram': ['627401', '627413', '627416'],
          'Nanguneri': ['627108', '627109', '627110']
        }
      },
      'Thanjavur': {
        code: 'TNJ',
        divisions: {
          'Thanjavur Division': ['613001', '613005', '613007', '613009'],
          'Kumbakonam Division': ['612001', '612002', '612501'],
          'Pattukkottai': ['614601', '614602', '614613']
        }
      },
      'Cuddalore': {
        code: 'CDL',
        divisions: {
          'Cuddalore Division': ['607001', '607002', '607003'],
          'Chidambaram': ['608001', '608002', '608102'],
          'Vriddhachalam': ['606001', '606003', '606103']
        }
      },
      'Namakkal': {
        code: 'NMK',
        divisions: {
          'Namakkal Division': ['637001', '637002', '637003'],
          'Rasipuram Division': ['637408', '637409', '637410'],
          'Tiruchengode': ['637211', '637214', '637215']
        }
      },
      'Dindigul': {
        code: 'DGL',
        divisions: {
          'Dindigul Division': ['624001', '624003', '624005'],
          'Palani Division': ['624601', '624602', '624618'],
          'Kodaikanal': ['624101', '624102', '624103']
        }
      },
      'Nilgiris': {
        code: 'NIL',
        divisions: {
          'Udhagamandalam (Ooty)': ['643001', '643002', '643004'],
          'Coonoor Division': ['643101', '643102', '643103'],
          'Gudalur Division': ['643211', '643212', '643231']
        }
      },
      'Kanyakumari': {
        code: 'KKI',
        divisions: {
          'Nagercoil Division': ['629001', '629002', '629004'],
          'Thuckalay Division': ['629175', '629176', '629180'],
          'Kanyakumari Town': ['629702', '629704']
        }
      },
      'Theni': {
        code: 'THN',
        divisions: {
          'Theni Division': ['625531', '625534', '625535'],
          'Periyakulam': ['625601', '625602', '625604'],
          'Bodinayakanur': ['625513', '625582']
        }
      },
      'Thoothukudi': {
        code: 'THO',
        divisions: {
          'Tuticorin Division': ['628001', '628002', '628003', '628008'],
          'Kovilpatti Division': ['628501', '628502', '628503'],
          'Tiruchendur': ['628215', '628216', '628218']
        }
      },
      'Ramanathapuram': {
        code: 'RMD',
        divisions: {
          'Ramanathapuram Division': ['623501', '623502', '623504'],
          'Paramakudi': ['623707', '623708'],
          'Rameswaram': ['623526', '623529']
        }
      },
      'Sivaganga': {
        code: 'SVG',
        divisions: {
          'Sivaganga Division': ['630561', '630562'],
          'Karaikudi Division': ['630001', '630002', '630003'],
          'Devakottai': ['630302', '630303']
        }
      },
      'Pudukkottai': {
        code: 'PUD',
        divisions: {
          'Pudukkottai Division': ['622001', '622002', '622005'],
          'Aranthangi': ['614616', '614617'],
          'Alangudi': ['622301', '622303']
        }
      },
      'Nagapattinam': {
        code: 'NGP',
        divisions: {
          'Nagapattinam Division': ['611001', '611002', '611003'],
          'Velankanni': ['611111', '611112'],
          'Vedaranyam': ['614810', '614811']
        }
      },
      'Mayiladuthurai': {
        code: 'MYD',
        divisions: {
          'Mayiladuthurai Division': ['609001', '609002', '609003'],
          'Sirkali': ['609110', '609111'],
          'Tharangambadi': ['609307', '609313']
        }
      },
      'Karur': {
        code: 'KRR',
        divisions: {
          'Karur Division': ['639001', '639002', '639004'],
          'Kulithalai': ['639107', '639120'],
          'Aravakurichi': ['639201', '639202']
        }
      },
      'Perambalur': {
        code: 'PBL',
        divisions: {
          'Perambalur Division': ['621212', '621213', '621220'],
          'Kunnam': ['621708', '621713']
        }
      },
      'Ariyalur': {
        code: 'ARI',
        divisions: {
          'Ariyalur Division': ['621704', '621705', '621715'],
          'Jayankondam': ['621802', '621804']
        }
      },
      'Tiruvannamalai': {
        code: 'TVM',
        divisions: {
          'Tiruvannamalai Division': ['606601', '606602', '606603'],
          'Polur Division': ['606803', '606804'],
          'Arni Division': ['632301', '632302']
        }
      },
      'Viluppuram': {
        code: 'VPM',
        divisions: {
          'Villupuram Division': ['605602', '605603', '605604'],
          'Tindivanam': ['604001', '604002'],
          'Gingee': ['604202', '604205']
        }
      },
      'Kallakurichi': {
        code: 'KLK',
        divisions: {
          'Kallakurichi Division': ['606202', '606206', '606213'],
          'Ulundurpet': ['606107', '606108'],
          'Sankarapuram': ['606401', '606402']
        }
      },
      'Tiruvallur': {
        code: 'TLR',
        divisions: {
          'Tiruvallur Division': ['602001', '602002', '602003'],
          'Poonamallee': ['600056', '600077', '600123'],
          'Gummidipoondi': ['601201', '601202']
        }
      },
      'Ranipet': {
        code: 'RPT',
        divisions: {
          'Ranipet Division': ['632401', '632402', '632404'],
          'Arakkonam': ['631001', '631002', '631003'],
          'Walaja': ['632513', '632514']
        }
      },
      'Tirupathur': {
        code: 'TPR',
        divisions: {
          'Tirupathur Division': ['635601', '635602', '635653'],
          'Vaniyambadi': ['635751', '635752'],
          'Ambur': ['635802', '635804']
        }
      },
      'Tenkasi': {
        code: 'TKS',
        divisions: {
          'Tenkasi Division': ['627811', '627812', '627814'],
          'Sankarankovil': ['627756', '627757'],
          'Kadayanallur': ['627751', '627759']
        }
      },
      'Tiruvarur': {
        code: 'TVR',
        divisions: {
          'Tiruvarur Division': ['610001', '610002', '610004'],
          'Mannargudi': ['614001', '614002', '614016'],
          'Thiruthuraipoondi': ['614713', '614715']
        }
      },
      'Virudhunagar': {
        code: 'VDN',
        divisions: {
          'Virudhunagar Division': ['626001', '626002', '626003'],
          'Sivakasi': ['626123', '626124', '626130'],
          'Rajapalayam': ['626117', '626119']
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
          'Bengaluru South': ['560004', '560011', '560029', '560034', '560076'],
          'Bengaluru North': ['560005', '560024', '560032', '560064']
        }
      },
      'Bengaluru Rural': {
        code: 'BRU',
        divisions: {
          'Doddaballapura': ['561203', '561205'],
          'Devanahalli': ['562110', '562129'],
          'Hosakote': ['562114', '562122'],
          'Nelamangala': ['562123', '562130']
        }
      },
      'Mysuru': {
        code: 'MYS',
        divisions: {
          'Mysuru City': ['570001', '570004', '570008', '570020'],
          'Nanjangud': ['571301', '571302'],
          'Hunsur': ['571105', '571189']
        }
      },
      'Dakshina Kannada': {
        code: 'DKA',
        divisions: {
          'Mangaluru City': ['575001', '575002', '575003', '575006'],
          'Puttur': ['574201', '574202'],
          'Bantwal': ['574211', '574219']
        }
      },
      'Belagavi': {
        code: 'BGM',
        divisions: {
          'Belagavi City': ['590001', '590002', '590006', '590016'],
          'Chikkodi': ['591201', '591213'],
          'Gokak': ['591307', '591310']
        }
      },
      'Dharwad': {
        code: 'DWD',
        divisions: {
          'Hubballi': ['580020', '580021', '580023', '580024'],
          'Dharwad City': ['580001', '580007', '580008']
        }
      },
      'Kalaburagi': {
        code: 'KLB',
        divisions: {
          'Kalaburagi City': ['585101', '585102', '585103'],
          'Sedam': ['585222', '585318']
        }
      },
      'Tumakuru': {
        code: 'TMK',
        divisions: {
          'Tumakuru City': ['572101', '572102', '572103'],
          'Tiptur': ['572201', '572202']
        }
      },
      'Ballari': {
        code: 'BLI',
        divisions: {
          'Ballari City': ['583101', '583102', '583104'],
          'Siruguppa': ['583121', '583122']
        }
      },
      'Udupi': {
        code: 'UDP',
        divisions: {
          'Udupi City': ['576101', '576102', '576104'],
          'Kundapura': ['576201', '576211']
        }
      },
      'Shivamogga': {
        code: 'SMG',
        divisions: {
          'Shivamogga City': ['577201', '577202', '577204'],
          'Bhadravati': ['577301', '577302']
        }
      },
      'Hassan': {
        code: 'HSN',
        divisions: {
          'Hassan City': ['573201', '573202'],
          'Arsikere': ['573103', '573125']
        }
      }
    }
  },

  'Kerala': {
    code: 'KL',
    districts: {
      'Thiruvananthapuram': {
        code: 'TVM',
        divisions: {
          'Trivandrum City': ['695001', '695002', '695004', '695011'],
          'Attingal': ['695101', '695102'],
          'Neyyattinkara': ['695121', '695122']
        }
      },
      'Ernakulam': {
        code: 'EKM',
        divisions: {
          'Kochi / Ernakulam City': ['682001', '682011', '682016', '682035'],
          'Aluva': ['683101', '683102'],
          'Muvattupuzha': ['686661', '686673']
        }
      },
      'Kozhikode': {
        code: 'KKD',
        divisions: {
          'Calicut City': ['673001', '673002', '673004', '673011'],
          'Vatakara': ['673101', '673104']
        }
      },
      'Thrissur': {
        code: 'TSR',
        divisions: {
          'Thrissur City': ['680001', '680004', '680020'],
          'Irinjalakuda': ['680121', '680125']
        }
      },
      'Kollam': {
        code: 'KLM',
        divisions: {
          'Kollam City': ['691001', '691002', '691009'],
          'Karunagappally': ['690518', '690544']
        }
      },
      'Palakkad': {
        code: 'PLK',
        divisions: {
          'Palakkad City': ['678001', '678002', '678004'],
          'Ottapalam': ['679101', '679103']
        }
      },
      'Malappuram': {
        code: 'MLP',
        divisions: {
          'Malappuram City': ['676505', '676509'],
          'Manjeri': ['676121', '676122'],
          'Tirur': ['676101', '676104']
        }
      },
      'Kannur': {
        code: 'KNR',
        divisions: {
          'Kannur City': ['670001', '670002', '670003'],
          'Thalassery': ['670101', '670102']
        }
      },
      'Kottayam': {
        code: 'KTM',
        divisions: {
          'Kottayam City': ['686001', '686002', '686004'],
          'Changanassery': ['686101', '686102']
        }
      },
      'Alappuzha': {
        code: 'ALP',
        divisions: {
          'Alappuzha City': ['688001', '688002', '688007'],
          'Mavelikkara': ['690101', '690102']
        }
      },
      'Pathanamthitta': {
        code: 'PTA',
        divisions: {
          'Pathanamthitta City': ['689645', '689648'],
          'Thiruvalla': ['689101', '689105']
        }
      },
      'Idukki': {
        code: 'IDK',
        divisions: {
          'Thodupuzha': ['685584', '685585'],
          'Munnar': ['685612', '685615']
        }
      },
      'Wayanad': {
        code: 'WYD',
        divisions: {
          'Kalpetta': ['673121', '673122'],
          'Mananthavady': ['670645', '670646']
        }
      },
      'Kasaragod': {
        code: 'KSD',
        divisions: {
          'Kasaragod City': ['671121', '671123'],
          'Kanhangad': ['671315', '671316']
        }
      }
    }
  },

  'Maharashtra': {
    code: 'MH',
    districts: {
      'Mumbai City': {
        code: 'MUM',
        divisions: {
          'Mumbai GPO': ['400001', '400002', '400004', '400005'],
          'Mumbai Central': ['400007', '400008', '400026', '400034'],
          'Dadar Division': ['400014', '400025', '400028']
        }
      },
      'Mumbai Suburban': {
        code: 'MSU',
        divisions: {
          'Bandra Division': ['400050', '400051', '400052'],
          'Andheri Division': ['400053', '400058', '400069'],
          'Borivali Division': ['400066', '400091', '400092']
        }
      },
      'Pune': {
        code: 'PUN',
        divisions: {
          'Pune City East': ['411001', '411006', '411014'],
          'Pune City West': ['411004', '411005', '411030', '411038'],
          'Pimpri-Chinchwad': ['411017', '411018', '411019', '411033'],
          'Baramati': ['413102', '413133']
        }
      },
      'Nagpur': {
        code: 'NGP',
        divisions: {
          'Nagpur City': ['440001', '440002', '440010', '440012'],
          'Nagpur Rural': ['441108', '441110']
        }
      },
      'Thane': {
        code: 'THN',
        divisions: {
          'Thane City': ['400601', '400602', '400604', '400607'],
          'Kalyan': ['421301', '421304', '421306']
        }
      },
      'Nashik': {
        code: 'NSK',
        divisions: {
          'Nashik City': ['422001', '422002', '422005', '422009'],
          'Malegaon': ['423203', '423204']
        }
      },
      'Chhatrapati Sambhaji Nagar': {
        code: 'CSN',
        divisions: {
          'City Division': ['431001', '431002', '431005'],
          'Paithan': ['431107', '431148']
        }
      }
    }
  },

  'Andhra Pradesh': {
    code: 'AP',
    districts: {
      'Visakhapatnam': {
        code: 'VSK',
        divisions: {
          'Visakhapatnam City': ['530001', '530002', '530003', '530016', '530020'],
          'Anakapalle': ['531001', '531002']
        }
      },
      'Vijayawada (NTR)': {
        code: 'NTR',
        divisions: {
          'Vijayawada City': ['520001', '520002', '520003', '520010'],
          'Nandigama': ['521185', '521186']
        }
      },
      'Guntur': {
        code: 'GNT',
        divisions: {
          'Guntur City': ['522001', '522002', '522004', '522006'],
          'Tenali': ['522201', '522202']
        }
      },
      'Tirupati': {
        code: 'TPT',
        divisions: {
          'Tirupati City': ['517501', '517502', '517507'],
          'Srikalahasti': ['517644', '517645']
        }
      },
      'Kurnool': {
        code: 'KNL',
        divisions: {
          'Kurnool City': ['518001', '518002', '518003'],
          'Adoni': ['518301', '518302']
        }
      }
    }
  },

  'Telangana': {
    code: 'TS',
    districts: {
      'Hyderabad': {
        code: 'HYD',
        divisions: {
          'Hyderabad GPO / Central': ['500001', '500002', '500004', '500020'],
          'Secunderabad': ['500003', '500009', '500011', '500025'],
          'Cyberabad / Hitec City': ['500081', '500082', '500084', '500090']
        }
      },
      'Ranga Reddy': {
        code: 'RRD',
        divisions: {
          'Shamshabad': ['501218', '501509'],
          'Rajendranagar': ['500030', '500048']
        }
      },
      'Warangal': {
        code: 'WGL',
        divisions: {
          'Warangal City': ['506001', '506002', '506007'],
          'Hanamkonda': ['506001', '506009', '506015']
        }
      }
    }
  },

  'Delhi': {
    code: 'DL',
    districts: {
      'New Delhi': {
        code: 'NDL',
        divisions: {
          'Connaught Place / GPO': ['110001', '110002', '110003'],
          'Chanakyapuri': ['110021', '110023']
        }
      },
      'South Delhi': {
        code: 'SDL',
        divisions: {
          'Hauz Khas / Saket': ['110016', '110017', '110029'],
          'Kalkaji / Nehru Place': ['110019', '110048', '110065']
        }
      },
      'Central Delhi': {
        code: 'CDL',
        divisions: {
          'Karol Bagh': ['110005', '110060'],
          'Pahar Ganj': ['110055', '110064']
        }
      },
      'North Delhi': {
        code: 'NDH',
        divisions: {
          'Civil Lines': ['110006', '110007', '110054'],
          'Rohini': ['110085', '110086']
        }
      }
    }
  },

  'Gujarat': {
    code: 'GJ',
    districts: {
      'Ahmedabad': {
        code: 'AMD',
        divisions: {
          'Ahmedabad City': ['380001', '380006', '380009', '380015'],
          'Gandhinagar Border': ['380054', '382421']
        }
      },
      'Surat': {
        code: 'SRT',
        divisions: {
          'Surat City': ['395001', '395002', '395003', '395007'],
          'Rander': ['395005', '395009']
        }
      },
      'Vadodara': {
        code: 'VAD',
        divisions: {
          'Vadodara City': ['390001', '390002', '390007', '390020']
        }
      },
      'Rajkot': {
        code: 'RJK',
        divisions: {
          'Rajkot City': ['360001', '360002', '360004', '360005']
        }
      }
    }
  },

  'Uttar Pradesh': {
    code: 'UP',
    districts: {
      'Lucknow': {
        code: 'LKO',
        divisions: {
          'Lucknow GPO': ['226001', '226002', '226003', '226010', '226016']
        }
      },
      'Kanpur Nagar': {
        code: 'KNP',
        divisions: {
          'Kanpur City': ['208001', '208002', '208012', '208024']
        }
      },
      'Gautam Buddha Nagar (Noida)': {
        code: 'NOI',
        divisions: {
          'Noida City': ['201301', '201303', '201304', '201307'],
          'Greater Noida': ['201306', '201308', '201310']
        }
      },
      'Varanasi': {
        code: 'VNS',
        divisions: {
          'Varanasi City': ['221001', '221002', '221005', '221010']
        }
      },
      'Agra': {
        code: 'AGR',
        divisions: {
          'Agra City': ['282001', '282002', '282003', '282005']
        }
      }
    }
  },

  'West Bengal': {
    code: 'WB',
    districts: {
      'Kolkata': {
        code: 'KOL',
        divisions: {
          'Kolkata GPO': ['700001', '700007', '700012', '700019', '700029', '700071']
        }
      },
      'Howrah': {
        code: 'HWH',
        divisions: {
          'Howrah City': ['711101', '711102', '711104', '711106']
        }
      },
      'North 24 Parganas': {
        code: 'N24',
        divisions: {
          'Bidhannagar / Salt Lake': ['700064', '700091', '700098', '700102'],
          'Barasat': ['700124', '700125']
        }
      }
    }
  },

  'Rajasthan': {
    code: 'RJ',
    districts: {
      'Jaipur': {
        code: 'JPR',
        divisions: {
          'Jaipur City': ['302001', '302002', '302004', '302015', '302017', '302020']
        }
      },
      'Jodhpur': {
        code: 'JDH',
        divisions: {
          'Jodhpur City': ['342001', '342003', '342006']
        }
      },
      'Udaipur': {
        code: 'UDP',
        divisions: {
          'Udaipur City': ['313001', '313002', '313004']
        }
      }
    }
  },

  'Punjab': {
    code: 'PB',
    districts: {
      'Ludhiana': {
        code: 'LDH',
        divisions: {
          'Ludhiana City': ['141001', '141002', '141003', '141008']
        }
      },
      'Amritsar': {
        code: 'ASR',
        divisions: {
          'Amritsar City': ['143001', '143002', '143006']
        }
      },
      'Jalandhar': {
        code: 'JLD',
        divisions: {
          'Jalandhar City': ['144001', '144002', '144008']
        }
      }
    }
  },

  'Haryana': {
    code: 'HR',
    districts: {
      'Gurugram': {
        code: 'GGM',
        divisions: {
          'Gurugram City / Cyber City': ['122001', '122002', '122003', '122018', '122022']
        }
      },
      'Faridabad': {
        code: 'FBD',
        divisions: {
          'Faridabad City': ['121001', '121002', '121004', '121007']
        }
      }
    }
  },

  'Madhya Pradesh': {
    code: 'MP',
    districts: {
      'Bhopal': {
        code: 'BPL',
        divisions: {
          'Bhopal City': ['462001', '462003', '462011', '462016']
        }
      },
      'Indore': {
        code: 'IND',
        divisions: {
          'Indore City': ['452001', '452002', '452003', '452010']
        }
      }
    }
  },

  'Bihar': {
    code: 'BR',
    districts: {
      'Patna': {
        code: 'PAT',
        divisions: {
          'Patna GPO / City': ['800001', '800002', '800003', '800020']
        }
      },
      'Gaya': {
        code: 'GAY',
        divisions: {
          'Gaya City': ['823001', '823002', '823003']
        }
      }
    }
  },

  'Odisha': {
    code: 'OD',
    districts: {
      'Khordha (Bhubaneswar)': {
        code: 'BBS',
        divisions: {
          'Bhubaneswar City': ['751001', '751002', '751003', '751012', '751024']
        }
      },
      'Cuttack': {
        code: 'CTC',
        divisions: {
          'Cuttack City': ['753001', '753002', '753003']
        }
      }
    }
  },

  'Assam': {
    code: 'AS',
    districts: {
      'Kamrup Metropolitan (Guwahati)': {
        code: 'GHY',
        divisions: {
          'Guwahati City': ['781001', '781003', '781005', '781006', '781022']
        }
      }
    }
  }
};

// All 28 States + 8 Union Territories list
export const ALL_INDIAN_STATES = [
  'Andhra Pradesh',
  'Arunachal Pradesh',
  'Assam',
  'Bihar',
  'Chhattisgarh',
  'Goa',
  'Gujarat',
  'Haryana',
  'Himachal Pradesh',
  'Jharkhand',
  'Karnataka',
  'Kerala',
  'Madhya Pradesh',
  'Maharashtra',
  'Manipur',
  'Meghalaya',
  'Mizoram',
  'Nagaland',
  'Odisha',
  'Punjab',
  'Rajasthan',
  'Sikkim',
  'Tamil Nadu',
  'Telangana',
  'Tripura',
  'Uttar Pradesh',
  'Uttarakhand',
  'West Bengal',
  'Andaman and Nicobar Islands',
  'Chandigarh',
  'Dadra and Nagar Haveli and Daman and Diu',
  'Delhi',
  'Jammu and Kashmir',
  'Ladakh',
  'Lakshadweep',
  'Puducherry'
];

/**
 * Get all available districts for a specified State.
 * Falls back to default district if state is not in primary list.
 */
export function getDistrictsForState(stateName) {
  if (!stateName) return [];
  const stateData = INDIA_POSTAL_DATA[stateName];
  if (stateData && stateData.districts) {
    return Object.keys(stateData.districts).sort();
  }

  // Common fallbacks for other states if not explicitly key-mapped above
  const genericDistricts = {
    'Andhra Pradesh': ['Alluri Sitharama Raju', 'Anakapalli', 'Ananthapuramu', 'Annamayya', 'Bapatla', 'Chittoor', 'Dr. B.R. Ambedkar Konaseema', 'East Godavari', 'Eluru', 'Guntur', 'Kakinada', 'Krishna', 'Kurnool', 'Nandyal', 'NTR', 'Palnadu', 'Parvathipuram Manyam', 'Prakasam', 'Sri Potti Sriramulu Nellore', 'Sri Sathya Sai', 'Srikakulam', 'Tirupati', 'Visakhapatnam', 'Vizianagaram', 'West Godavari', 'YSR Kadapa'],
    'Arunachal Pradesh': ['Anjaw', 'Changlang', 'Dibang Valley', 'East Kameng', 'East Siang', 'Itanagar', 'Kamle', 'Kra Daadi', 'Kurung Kumey', 'Lepa Rada', 'Lohit', 'Longding', 'Lower Dibang Valley', 'Lower Siang', 'Lower Subansiri', 'Namsai', 'Pakke Kessang', 'Papum Pare', 'Shi Yomi', 'Siang', 'Tawang', 'Tirap', 'Upper Siang', 'Upper Subansiri', 'West Kameng', 'West Siang'],
    'Assam': ['Baksa', 'Barpeta', 'Biswanath', 'Bongaigaon', 'Cachar', 'Charaideo', 'Chirang', 'Darrang', 'Dhemaji', 'Dhubri', 'Dibrugarh', 'Dima Hasao', 'Goalpara', 'Golaghat', 'Hailakandi', 'Hojai', 'Jorhat', 'Kamrup', 'Kamrup Metropolitan (Guwahati)', 'Karbi Anglong', 'Karimganj', 'Kokrajhar', 'Lakhimpur', 'Majuli', 'Morigaon', 'Nagaon', 'Nalbari', 'Sivasagar', 'Sonitpur', 'South Salmara-Mankachar', 'Tinsukia', 'Udalguri', 'West Karbi Anglong'],
    'Bihar': ['Araria', 'Arwal', 'Aurangabad', 'Banka', 'Begusarai', 'Bhagalpur', 'Bhojpur', 'Buxar', 'Darbhanga', 'East Champaran', 'Gaya', 'Gopalganj', 'Jamui', 'Jehanabad', 'Kaimur', 'Katihar', 'Khagaria', 'Kishanganj', 'Lakhisarai', 'Madhepura', 'Madhubani', 'Munger', 'Muzaffarpur', 'Nalanda', 'Nawada', 'Patna', 'Purnia', 'Rohtas', 'Saharsa', 'Samastipur', 'Saran', 'Sheikhpura', 'Sheohar', 'Sitamarhi', 'Siwan', 'Supaul', 'Vaishali', 'West Champaran'],
    'Chhattisgarh': ['Balod', 'Baloda Bazar', 'Balrampur', 'Bemetara', 'Bijapur', 'Bilaspur', 'Dantewada', 'Dhamtari', 'Durg', 'Gariaband', 'Gaurela-Pendra-Marwahi', 'Janjgir-Champa', 'Jashpur', 'Kabirdham', 'Kanker', 'Khairagarh', 'Kondagaon', 'Korba', 'Koriya', 'Mahasamund', 'Manendragarh', 'Mohla-Manpur', 'Mungeli', 'Narayanpur', 'Raigarh', 'Raipur', 'Rajnandgaon', 'Sarangarh-Bilaigarh', 'Sakti', 'Sukma', 'Surajpur', 'Surguja'],
    'Goa': ['North Goa', 'South Goa'],
    'Gujarat': ['Ahmedabad', 'Amreli', 'Anand', 'Aravalli', 'Banaskantha', 'Bharuch', 'Bhavnagar', 'Botad', 'Chhota Udaipur', 'Dahod', 'Dang', 'Devbhoomi Dwarka', 'Gandhinagar', 'Gir Somnath', 'Jamnagar', 'Junagadh', 'Kheda', 'Kutch', 'Mahisagar', 'Mehsana', 'Morbi', 'Narmada', 'Navsari', 'Panchmahal', 'Patan', 'Porbandar', 'Rajkot', 'Sabarkantha', 'Surat', 'Surendranagar', 'Tapi', 'Vadodara', 'Valsad'],
    'Haryana': ['Ambala', 'Bhiwani', 'Charkhi Dadri', 'Faridabad', 'Fatehabad', 'Gurugram', 'Hisar', 'Jhajjar', 'Jind', 'Kaithal', 'Karnal', 'Kurukshetra', 'Mahendragarh', 'Nuh', 'Palwal', 'Panchkula', 'Panipat', 'Rewari', 'Rohtak', 'Sirsa', 'Sonipat', 'Yamunanagar'],
    'Himachal Pradesh': ['Bilaspur', 'Chamba', 'Hamirpur', 'Kangra', 'Kinnaur', 'Kullu', 'Lahaul and Spiti', 'Mandi', 'Shimla', 'Sirmaur', 'Solan', 'Una'],
    'Jharkhand': ['Bokaro', 'Chatra', 'Deoghar', 'Dhanbad', 'Dumka', 'East Singhbhum', 'Garhwa', 'Giridih', 'Godda', 'Gumla', 'Hazaribagh', 'Jamtara', 'Khunti', 'Koderma', 'Latehar', 'Lohardaga', 'Pakur', 'Palamu', 'Ramgarh', 'Ranchi', 'Sahibganj', 'Seraikela Kharsawan', 'Simdega', 'West Singhbhum'],
    'Puducherry': ['Puducherry', 'Karaikal', 'Mahe', 'Yanam'],
    'Chandigarh': ['Chandigarh'],
    'Jammu and Kashmir': ['Anantnag', 'Bandipora', 'Baramulla', 'Budgam', 'Doda', 'Ganderbal', 'Jammu', 'Kathua', 'Kishtwar', 'Kulgam', 'Kupwara', 'Poonch', 'Pulwama', 'Rajouri', 'Ramban', 'Reasi', 'Samba', 'Shopian', 'Srinagar', 'Udhampur'],
    'Ladakh': ['Kargil', 'Leh']
  };

  return (genericDistricts[stateName] || ['Central District', 'North District', 'South District', 'East District', 'West District']).sort();
}

/**
 * Get divisions for a given state & district.
 */
export function getDivisionsForDistrict(stateName, districtName) {
  if (!stateName || !districtName) return [];
  const sKey = Object.keys(INDIA_POSTAL_DATA).find(k => k.toLowerCase() === stateName.trim().toLowerCase()) || stateName;
  const stateData = INDIA_POSTAL_DATA[sKey];
  if (stateData?.districts) {
    const dKey = Object.keys(stateData.districts).find(k => k.toLowerCase() === districtName.trim().toLowerCase()) || districtName;
    if (stateData.districts[dKey]?.divisions) {
      return Object.keys(stateData.districts[dKey].divisions).sort();
    }
  }

  // Sensible default divisions if district exists
  return [
    `${districtName} Central`,
    `${districtName} North`,
    `${districtName} South`,
    `${districtName} East`,
    `${districtName} West`
  ];
}

/**
 * Get postal PIN codes for a given state, district, and division.
 */
export function getPincodesForDivision(stateName, districtName, divisionName) {
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
