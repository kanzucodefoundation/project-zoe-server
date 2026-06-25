import { Injectable, Logger } from '@nestjs/common';
import { InjectConnection } from '@nestjs/typeorm';
import { Connection, Repository } from 'typeorm';
import Group from 'src/groups/entities/group.entity';
import GroupCategory from 'src/groups/entities/groupCategory.entity';
import { Tenant } from 'src/tenants/entities/tenant.entity';
import { GroupPrivacy } from 'src/groups/enums/groupPrivacy';
import GroupMembership from 'src/groups/entities/groupMembership.entity';
import { GroupRole } from 'src/groups/enums/groupRole';
import { User } from 'src/users/entities/user.entity';

// ---------------------------------------------------------------------------
// Location master list  (source: worship_harvest_categorization_data + user-supplied)
// New locations added 2026-06-25: WHKRKU, WHMSJJ, WHBWMB, WHSTMG
// ---------------------------------------------------------------------------
const WHM_LOCATIONS: { code: string; name: string }[] = [
  { code: 'WHABYT', name: 'WH Abayita' },
  { code: 'WHAFOL', name: 'WH Africa Online' },
  { code: 'WHAPAC', name: 'WH Apac' },
  { code: 'WHARUA', name: 'WH Arua' },
  { code: 'WHASOL', name: 'WH Asia Online' },
  { code: 'WHAUST', name: 'WH Australia' },
  { code: 'WHBAJO', name: 'WH Bajjo' },
  { code: 'WHBDKA', name: 'WH Budaka' },
  { code: 'WHBDND', name: 'WH Budondo' },
  { code: 'WHBGLB', name: 'WH Bugolobi' },
  { code: 'WHBGMB', name: 'WH Bugembe' },
  { code: 'WHBHRW', name: 'WH Biharwe' },
  { code: 'WHBKRR', name: 'WH Bukerere' },
  { code: 'WHBKSA', name: 'WH Bukasa' },
  { code: 'WHBKTO', name: 'WH Bukoto' },
  { code: 'WHBLID', name: 'WH Bulindo' },
  { code: 'WHBLND', name: 'WH Bulondo' },
  { code: 'WHBMDA', name: 'WH Bermuda' },
  { code: 'WHBNDO', name: 'WH Bondo' },
  { code: 'WHBNMY', name: 'WH Bunamwaya' },
  { code: 'WHBSBL', name: 'WH Busabala' },
  { code: 'WHBSGA', name: 'WH Busega' },
  { code: 'WHBSHY', name: 'WH Bushenyi' },
  { code: 'WHBSKM', name: 'WH Busukuma' },
  { code: 'WHBUDO', name: 'WH Buddo' },
  { code: 'WHBULB', name: 'WH Buloba' },
  { code: 'WHBUSK', name: 'WH Busiika' },
  { code: 'WHBWBJ', name: 'WH Bwebajja' },
  { code: 'WHBWGA', name: 'WH Bwerenga' },
  { code: 'WHBWMB', name: 'WH Buwambo' }, // new 2026-06-25
  { code: 'WHBWNG', name: 'WH Buwenge' },
  { code: 'WHBWYA', name: 'WH Buwaya' },
  { code: 'WHBYGR', name: 'WH Bweyogerere' },
  { code: 'WHBZGA', name: 'WH Buziga' },
  { code: 'WHCNDA', name: 'WH Canada' },
  { code: 'WHDRSM', name: 'WH Dar es Salaam' },
  { code: 'WHDWTN', name: 'WH Downtown' },
  { code: 'WHEBCT', name: 'WH Entebbe Central' },
  { code: 'WHENTB', name: 'WH Entebbe' },
  { code: 'WHEONL', name: 'WH Europe Online' },
  { code: 'WHFTPT', name: 'WH FortPortal' },
  { code: 'WHGBRD', name: 'WH Ggaba Road' },
  { code: 'WHGMNY', name: 'WH Germany' },
  { code: 'WHGNVA', name: 'WH Geneva' },
  { code: 'WHGOMB', name: 'WH Gomba' },
  { code: 'WHGRUG', name: 'WH Garuga' },
  { code: 'WHGULU', name: 'WH Gulu' },
  { code: 'WHGYZA', name: 'WH Gayaza' },
  { code: 'WHHOMA', name: 'WH Hoima' },
  { code: 'WHIBND', name: 'WH Ibanda' },
  { code: 'WHICMS', name: 'WH Iganga CMS' },
  { code: 'WHIDUD', name: 'WH Idudi' },
  { code: 'WHIGNG', name: 'WH Iganga' },
  { code: 'WHISHK', name: 'WH Ishaka' },
  { code: 'WHJNJA', name: 'WH Jinja' },
  { code: 'WHJOGO', name: 'WH Joggo' },
  { code: 'WHJUJA', name: 'WH Juja' },
  { code: 'WHKBBI', name: 'WH Kibibi' },
  { code: 'WHKBKO', name: 'WH Koboko' },
  { code: 'WHKBLE', name: 'WH Kabale' },
  { code: 'WHKBLI', name: 'WH Kibuli' },
  { code: 'WHKBMB', name: 'WH Kabembe' },
  { code: 'WHKBNG', name: 'WH Kibinge' },
  { code: 'WHKBUB', name: 'WH Kabubu' },
  { code: 'WHKBYE', name: 'WH Kibuye' },
  { code: 'WHKEOL', name: 'WH Kenya Online' },
  { code: 'WHKFLD', name: 'WH Krefeld' },
  { code: 'WHKGLI', name: 'WH Kigali' },
  { code: 'WHKGMB', name: 'WH Kigumba' },
  { code: 'WHKGNG', name: 'WH Kigungu' },
  { code: 'WHKHRA', name: 'WH Kaihura' },
  { code: 'WHKIRA', name: 'WH Kira' },
  { code: 'WHKISG', name: 'WH Kisoga' },
  { code: 'WHKITD', name: 'WH Kitende' },
  { code: 'WHKITI', name: 'WH Kiti' },
  { code: 'WHKITO', name: 'WH Kito-Kisooba' },
  { code: 'WHKJBJ', name: 'WH Kijabijjo' },
  { code: 'WHKJNS', name: 'WH Kajjansi' },
  { code: 'WHKKBA', name: 'WH Kakoba' },
  { code: 'WHKKRA', name: 'WH Kakira' },
  { code: 'WHKKRI', name: 'WH Kakiri' },
  { code: 'WHKLBR', name: 'WH Kulambiro' },
  { code: 'WHKLGI', name: 'WH Kalagi' },
  { code: 'WHKLMZ', name: 'WH Kilemezi' },
  { code: 'WHKLRO', name: 'WH Kaliro' },
  { code: 'WHKMBU', name: 'WH Kiambu' },
  { code: 'WHKMLI', name: 'WH Kamuli' },
  { code: 'WHKMNY', name: 'WH Kimwanyi' },
  { code: 'WHKRCH', name: 'WH Kericho' },
  { code: 'WHKRKU', name: 'WH Kireku' }, // new 2026-06-25
  { code: 'WHKRNY', name: 'WH Kirinya' },
  { code: 'WHKSAS', name: 'WH Kisaasi' },
  { code: 'WHKSBI', name: 'WH Kasubi' },
  { code: 'WHKSGJ', name: 'WH Kasengejje' },
  { code: 'WHKSNG', name: 'WH Kasenge' },
  { code: 'WHKSNJ', name: 'WH Kasanje' },
  { code: 'WHKSSE', name: 'WH Kasese' },
  { code: 'WHKTFB', name: 'WH Kitikifumba' },
  { code: 'WHKTGL', name: 'WH Kitengela' },
  { code: 'WHKTKT', name: 'WH Kitukutwe' },
  { code: 'WHKTND', name: 'WH Katende' },
  { code: 'WHKUNG', name: 'WH Kungu' },
  { code: 'WHKVLE', name: 'WH Kavule' },
  { code: 'WHKWED', name: 'WH Kiwenda' },
  { code: 'WHKWGA', name: 'WH Kiwanga' },
  { code: 'WHKWMP', name: 'WH Kawempe' },
  { code: 'WHKWND', name: 'WH Kawanda' },
  { code: 'WHKYBD', name: 'WH Kyebando' },
  { code: 'WHKYGG', name: 'WH Kyegegwa' },
  { code: 'WHKYGR', name: 'WH Kyengera' },
  { code: 'WHKYGW', name: 'WH Kayunga - Wakiso' },
  { code: 'WHKYJJ', name: 'WH Kyenjojo' },
  { code: 'WHKYNG', name: 'WH Kayunga' },
  { code: 'WHKYNJ', name: 'WH Kyanja' },
  { code: 'WHKYTM', name: 'WH Kyetume' },
  { code: 'WHLEDS', name: 'WH Leeds' },
  { code: 'WHLGBA', name: 'WH Lugoba' },
  { code: 'WHLGJA', name: 'WH Lungujja' },
  { code: 'WHLIRA', name: 'WH Lira' },
  { code: 'WHLKYA', name: 'WH Lukaya' },
  { code: 'WHLSNJ', name: 'WH Lusanja' },
  { code: 'WHLUGZ', name: 'WH Lugazi' },
  { code: 'WHLUKA', name: 'WH Luuka' },
  { code: 'WHLUSK', name: 'WH Lusaka' },
  { code: 'WHLUSZ', name: 'WH Lusaze' },
  { code: 'WHLUTN', name: 'WH Luton' },
  { code: 'WHLWRO', name: 'WH Luwero' },
  { code: 'WHLYTD', name: 'WH Lyantonde' },
  { code: 'WHLZRA', name: 'WH Luzira' },
  { code: 'WHMAYA', name: 'WH Maya' },
  { code: 'WHMBKO', name: 'WH Mbiko' },
  { code: 'WHMBLE', name: 'WH Mbale' },
  { code: 'WHMBND', name: 'WH Mubende' },
  { code: 'WHMBRA', name: 'WH Mbarara' },
  { code: 'WHMBSA', name: 'WH Mombasa' },
  { code: 'WHMCTY', name: 'WH Mukono city' },
  { code: 'WHMFBR', name: 'WH Mafubira' },
  { code: 'WHMGJO', name: 'WH Maganjo' },
  { code: 'WHMGMG', name: 'WH Magamaga' },
  { code: 'WHMGRE', name: 'WH Magere' },
  { code: 'WHMKNC', name: 'WH Mukono Central' },
  { code: 'WHMKND', name: 'WH Makindye' },
  { code: 'WHMKNO', name: 'WH Mukono' },
  { code: 'WHMKRR', name: 'WH Makerere' },
  { code: 'WHMNGO', name: 'WH Mengo' },
  { code: 'WHMPGI', name: 'WH Mpigi' },
  { code: 'WHMPRW', name: 'WH Mpererwe' },
  { code: 'WHMSDY', name: 'WH Misindye' },
  { code: 'WHMSJJ', name: 'WH Masajja' }, // new 2026-06-25
  { code: 'WHMSKA', name: 'WH Masaka' },
  { code: 'WHMSLT', name: 'WH Masulita' },
  { code: 'WHMSND', name: 'WH Masindi' },
  { code: 'WHMSNF', name: 'WH Masanafu' },
  { code: 'WHMTAI', name: 'WH Mutai' },
  { code: 'WHMTGB', name: 'WH Mutungo-Biina' },
  { code: 'WHMTND', name: 'WH Mutundwe' },
  { code: 'WHMTUG', name: 'WH Matugga' },
  { code: 'WHMTYN', name: 'WH Mityana' },
  { code: 'WHMWFU', name: 'WH Muwafu' },
  { code: 'WHMWRD', name: 'WH Mawanda Road' },
  { code: 'WHMYNG', name: 'WH Muyenga' },
  { code: 'WHNAJJ', name: 'WH Najjera' },
  { code: 'WHNBSG', name: 'WH Nabusugwe' },
  { code: 'WHNDJB', name: 'WH Ndejje-Bombo' },
  { code: 'WHNDJE', name: 'WH Ndejje' },
  { code: 'WHNEBB', name: 'WH Nebbi' },
  { code: 'WHNGBO', name: 'WH Nangabo' },
  { code: 'WHNGND', name: 'WH Nansana Gganda' },
  { code: 'WHNJRU', name: 'WH Njeru' },
  { code: 'WHNKFM', name: 'WH Nakifuma' },
  { code: 'WHNKLB', name: 'WH Nakulabye' },
  { code: 'WHNKMB', name: 'WH Nkumba' },
  { code: 'WHNKNJ', name: 'WH Nkonkojeru' },
  { code: 'WHNKSJ', name: 'WH Nakasajja' },
  { code: 'WHNKSK', name: 'WH Nakaseke' },
  { code: 'WHNKWA', name: 'WH Nakawa' },
  { code: 'WHNKWK', name: 'WH Nakawuka' },
  { code: 'WHNKWR', name: 'WH Nakwero' },
  { code: 'WHNLMY', name: 'WH Nalumunye' },
  { code: 'WHNLSA', name: 'WH Namulesa' },
  { code: 'WHNLYA', name: 'WH Naalya' },
  { code: 'WHNLYG', name: 'WH Namilyango' },
  { code: 'WHNMFR', name: 'WH Namafresh' },
  { code: 'WHNMGR', name: 'WH Namagera' },
  { code: 'WHNMLG', name: 'WH Namulonge' },
  { code: 'WHNMNV', name: 'WH Namanve' },
  { code: 'WHNMPG', name: 'WH Nampunge' }, // unassigned — no FOB in current list
  { code: 'WHNMTB', name: 'WH Namataba' },
  { code: 'WHNMWD', name: 'WH Namwendwa' },
  { code: 'WHNMWG', name: 'WH Namuwongo' },
  { code: 'WHNRBI', name: 'WH Nairobi' },
  { code: 'WHNSBW', name: 'WH Nsambwe' },
  { code: 'WHNSBY', name: 'WH Nsambya' },
  { code: 'WHNSGI', name: 'WH Nsangi' },
  { code: 'WHNSGU', name: 'WH Nsaggu' },
  { code: 'WHNSNA', name: 'WH Nansana' },
  { code: 'WHNSSA', name: 'WH Nsasa' },
  { code: 'WHNTDA', name: 'WH Ntinda' },
  { code: 'WHNTGM', name: 'WH Ntungamo' },
  { code: 'WHNTWO', name: 'WH Ntawo' },
  { code: 'WHNWLS', name: 'WH North Wales' },
  { code: 'WHNWPD', name: 'WH Nawampanda' },
  { code: 'WHNYDO', name: 'WH Nyendo' },
  { code: 'WHNYSA', name: 'WH Yesu Amala' },
  { code: 'WHONGR', name: 'WH Ongata Rongai' },
  { code: 'WHPDHA', name: 'WH Paidha' },
  { code: 'WHPKCH', name: 'WH Pakwach' },
  { code: 'WHPLSA', name: 'WH Pallisa' }, // unassigned — no FOB in current list
  { code: 'WHRBGA', name: 'WH Rubaga' },
  { code: 'WHRUIR', name: 'WH Ruiru' },
  { code: 'WHSEGK', name: 'WH Seguku' },
  { code: 'WHSETA', name: 'WH Seeta' },
  { code: 'WHSLRD', name: 'WH Salama Road' },
  { code: 'WHSNTM', name: 'WH Sentema' },
  { code: 'WHSOND', name: 'WH Sonde' },
  { code: 'WHSROT', name: 'WH Soroti' },
  { code: 'WHSTMG', name: 'WH Seeta-Magere' }, // new 2026-06-25
  { code: 'WHTEXS', name: 'WH Texas' },
  { code: 'WHTHKA', name: 'WH Thika' },
  { code: 'WHTRRO', name: 'WH Tororo' },
  { code: 'WHTULA', name: 'WH Tula' },
  { code: 'WHUKDM', name: 'WH United Kingdom' },
  { code: 'WHUSOA', name: 'WH United States of America' },
  { code: 'WHWBLZ', name: 'WH Wobulenzi' },
  { code: 'WHWGAN', name: 'WH Wigan' },
  { code: 'WHWKSO', name: 'WH Wakiso' },
  { code: 'WHWNDI', name: 'WH Wandi' },
  { code: 'WHWRKA', name: 'WH Wairaka' },
  { code: 'WHWTBA', name: 'WH Wattuba' },
  { code: 'WHZRBW', name: 'WH Zirobwe' },
];

// ---------------------------------------------------------------------------
// Full hierarchy: Movement → 6 Regions → 37 FOBs → Locations
// Source: "FOB and Locations.xlsx" + user-supplied 2026-06-25.
// Geographical region placement is a best-guess; admins can move FOBs after.
// ---------------------------------------------------------------------------
const REGION_FOB_LOCATION_MAP: {
  region: string;
  fobs: { name: string; codes: string[] }[];
}[] = [
  // Source: FOB DIA reports, 14th June 2026
  {
    region: 'Greater Kampala East',
    fobs: [
      {
        name: 'Naalya FOB',
        codes: ['WHNLYA'],
      },
      {
        name: 'Mukono FOB',
        codes: [
          'WHKBMB',
          'WHKYNG',
          'WHKITO',
          'WHLUGZ',
          'WHMKNO',
          'WHMCTY',
          'WHNKFM',
          'WHNTWO',
        ],
      },
      {
        name: 'Kitukutwe FOB',
        codes: [
          'WHKLGI',
          'WHKJBJ',
          'WHKTKT',
          'WHNBSG',
          'WHNKSJ',
          'WHNKWR',
          'WHNSSA',
          'WHKMNY',
        ],
      },
      {
        name: 'Makerere FOB',
        codes: ['WHKSBI', 'WHMKRR', 'WHMNGO', 'WHNKLB', 'WHNKMB'],
      },
      {
        name: 'Mukono Central FOB',
        codes: ['WHKISG', 'WHMKNC', 'WHNMTB', 'WHNKNJ', 'WHKYTM'],
      },
      {
        name: 'Kira FOB',
        codes: ['WHKIRA', 'WHKLBR', 'WHKYNJ', 'WHNAJJ', 'WHBWMB'],
      },
      {
        name: 'Kungu FOB',
        codes: ['WHKTFB', 'WHKUNG', 'WHMWRD', 'WHNMFR', 'WHSTMG'],
      },
      {
        name: 'Sonde FOB',
        codes: [
          'WHBYGR',
          'WHKWGA',
          'WHMSDY',
          'WHNTDA',
          'WHSOND',
          'WHSETA',
          'WHBLID',
        ],
      },
    ],
  },
  {
    region: 'Greater Kampala South',
    fobs: [
      {
        name: 'Kansanga FOB',
        codes: [
          'WHBSBL',
          'WHBZGA',
          'WHDWTN',
          'WHGBRD',
          'WHKBLI',
          'WHKBYE',
          'WHMKND',
          'WHMTND',
          'WHMYNG',
          'WHNDJE',
          'WHRBGA',
          'WHSLRD',
          'WHNSBY',
          'WHMSJJ',
        ],
      },
      {
        name: 'Bugolobi FOB',
        codes: [
          'WHBGLB',
          'WHBKSA',
          'WHKRNY',
          'WHLZRA',
          'WHMTGB',
          'WHNMWG',
          'WHKRKU',
        ],
      },
      {
        name: 'Nakawa FOB',
        codes: ['WHBKTO', 'WHLGJA', 'WHNKWA', 'WHLUSZ'],
      },
      {
        name: 'Entebbe FOB',
        codes: ['WHABYT', 'WHENTB', 'WHEBCT', 'WHGRUG', 'WHKGNG'],
      },
      {
        name: 'Joggo FOB',
        codes: ['WHBAJO', 'WHBKRR', 'WHJOGO', 'WHNMNV', 'WHNLYG', 'WHNSBW'],
      },
      {
        name: 'Kajjansi FOB',
        codes: [
          'WHBNMY',
          'WHBWBJ',
          'WHKJNS',
          'WHKITD',
          'WHSEGK',
          'WHNLMY',
          'WHBWGA',
        ],
      },
      {
        name: 'Nakawuka FOB',
        codes: ['WHNKWK', 'WHNSGU', 'WHBWYA', 'WHKSNJ', 'WHKSNG'],
      },
    ],
  },
  {
    region: 'Greater Kampala West',
    fobs: [
      {
        name: 'Gayaza FOB',
        codes: [
          'WHGYZA',
          'WHKSAS',
          'WHKYBD',
          'WHLSNJ',
          'WHMGRE',
          'WHMPRW',
          'WHNGBO',
        ],
      },
      {
        name: 'Wakiso FOB',
        codes: [
          'WHBULB',
          'WHBSGA',
          'WHKKRI',
          'WHKSGJ',
          'WHKYGW',
          'WHMSLT',
          'WHMTYN',
          'WHNSNA',
          'WHNGND',
          'WHWKSO',
          'WHNYSA',
        ],
      },
      {
        name: 'Kabubbu FOB',
        codes: ['WHBUSK', 'WHBSKM', 'WHKBUB', 'WHNMLG', 'WHZRBW', 'WHKWED'],
      },
      {
        name: 'Matugga FOB',
        codes: [
          'WHKVLE',
          'WHMTUG',
          'WHNKSK',
          'WHNDJB',
          'WHWTBA',
          'WHWBLZ',
          'WHLWRO',
        ],
      },
      {
        name: 'Mpigi FOB',
        codes: [
          'WHBUDO',
          'WHGOMB',
          'WHKTND',
          'WHKYGR',
          'WHMPGI',
          'WHNSGI',
          'WHMAYA',
        ],
      },
      {
        name: 'Kiti FOB',
        codes: [
          'WHKWND',
          'WHKWMP',
          'WHKLMZ',
          'WHKITI',
          'WHLGBA',
          'WHMGJO',
          'WHTULA',
        ],
      },
      {
        name: 'Sentema FOB',
        codes: ['WHMSNF', 'WHSNTM'],
      },
    ],
  },
  {
    region: 'Eastern Uganda',
    fobs: [
      {
        name: 'Jinja FOB',
        codes: [
          'WHBDND',
          'WHBGMB',
          'WHBWNG',
          'WHJNJA',
          'WHKBBI',
          'WHMBKO',
          'WHMTAI',
          'WHNJRU',
          'WHNWPD',
          'WHNMGR',
          'WHMFBR',
        ],
      },
      {
        name: 'Iganga FOB',
        codes: ['WHIDUD', 'WHIGNG', 'WHICMS', 'WHKLRO', 'WHLUKA'],
      },
      {
        name: 'Kamuli FOB',
        codes: ['WHBLND', 'WHKMLI', 'WHNMWD'],
      },
      {
        name: 'Wairaka FOB',
        codes: ['WHKKRA', 'WHMGMG', 'WHWRKA', 'WHNLSA'],
      },
      {
        name: 'Mbale FOB',
        codes: ['WHBDKA', 'WHMBLE', 'WHSROT', 'WHTRRO', 'WHMWFU'],
      },
      {
        name: 'Gulu FOB',
        codes: ['WHAPAC', 'WHGULU', 'WHLIRA'],
      },
    ],
  },
  {
    region: 'Western Uganda',
    fobs: [
      {
        name: 'Arua FOB',
        codes: [
          'WHARUA',
          'WHKBKO',
          'WHNEBB',
          'WHPDHA',
          'WHPKCH',
          'WHWNDI',
          'WHBNDO',
        ],
      },
      {
        name: 'Masaka FOB',
        codes: ['WHKBNG', 'WHLKYA', 'WHLYTD', 'WHMSKA', 'WHNYDO'],
      },
      {
        name: 'Mbarara FOB',
        codes: [
          'WHBHRW',
          'WHIBND',
          'WHISHK',
          'WHKBLE',
          'WHKKBA',
          'WHMBRA',
          'WHNTGM',
          'WHBSHY',
        ],
      },
      {
        name: 'Fort Portal FOB',
        codes: ['WHFTPT', 'WHKSSE', 'WHKYGG', 'WHKYJJ', 'WHMBND', 'WHKHRA'],
      },
      {
        name: 'Hoima FOB',
        codes: ['WHHOMA', 'WHMSND', 'WHKGMB'],
      },
    ],
  },
  {
    region: 'Global',
    fobs: [
      {
        name: 'Kenya FOB',
        codes: [
          'WHJUJA',
          'WHKEOL',
          'WHKRCH',
          'WHKMBU',
          'WHKTGL',
          'WHNRBI',
          'WHONGR',
          'WHRUIR',
          'WHTHKA',
          'WHMBSA',
        ],
      },
      {
        name: 'Rest of Africa FOB',
        codes: ['WHAFOL', 'WHASOL', 'WHDRSM', 'WHKGLI', 'WHLUSK'],
      },
      {
        name: 'Europe & Oceania FOB',
        codes: [
          'WHAUST',
          'WHEONL',
          'WHGNVA',
          'WHGMNY',
          'WHLEDS',
          'WHLUTN',
          'WHNWLS',
          'WHUKDM',
          'WHKFLD',
          'WHWGAN',
        ],
      },
      {
        name: 'Americas FOB',
        codes: ['WHTEXS', 'WHUSOA', 'WHBMDA', 'WHCNDA'],
      },
    ],
  },
];

// ---------------------------------------------------------------------------
// WHKTKT internal structure — zones and missional communities
// ---------------------------------------------------------------------------
const WHKTKT_ZONES: { name: string; mcs: { name: string }[] }[] = [
  {
    name: 'Bulindo',
    mcs: [{ name: 'Circle (A)' }, { name: 'Legit (A)' }, { name: 'Rock (A)' }],
  },
  {
    name: 'Cathedral Zone',
    mcs: [
      { name: 'Beloved (A)' },
      { name: 'Beyond Self (A)' },
      { name: 'Blessed Kids (C)' },
      { name: 'Feathers of Greatness (T)' },
      { name: 'Hopeful (T)' },
      { name: 'Matthew (A)' },
      { name: 'Miraculous (A)' },
      { name: 'Obedience (A)' },
      { name: 'Revelation (T)' },
      { name: 'Righteous (T)' },
      { name: 'Zion (C)' },
    ],
  },
  {
    name: 'Kazinga',
    mcs: [
      { name: "Be'zri (A)" },
      { name: 'Divine (C)' },
      { name: 'Grace (A)' },
      { name: 'Nissi (C)' },
    ],
  },
  {
    name: 'Kijabijjo',
    mcs: [
      { name: 'Bethel (T)' },
      { name: 'Christ The King (T)' },
      { name: 'Faithful (A)' },
      { name: 'Galatians (T)' },
      { name: 'Gates of Heaven (T)' },
      { name: 'Genesis (T)' },
      { name: 'Glory (C)' },
      { name: 'Justified (T)' },
      { name: 'Majesty (T)' },
      { name: 'Mulungi (A)' },
      { name: 'Overcomers (A)' },
      { name: 'Peace (C)' },
      { name: 'Peniel (T)' },
      { name: 'True Star (C)' },
      { name: 'Victory (T)' },
    ],
  },
  {
    name: 'Kira',
    mcs: [
      { name: 'Glorious (C)' },
      { name: 'Icons (A)' },
      { name: 'Kira Kapeera (A)' },
      { name: 'Sufficient (A)' },
    ],
  },
  {
    name: 'Kitukutwe',
    mcs: [
      { name: 'Arrows (C)' },
      { name: 'Beautiful (A)' },
      { name: 'Gratitude (A)' },
      { name: 'Multitudes (A)' },
      { name: 'Rooted (A)' },
      { name: 'Shalom (C)' },
    ],
  },
  {
    name: 'Kitukutwe 2',
    mcs: [
      { name: 'Agape (A)' },
      { name: 'Beacon of Power (A)' },
      { name: 'Kwagala (A)' },
      { name: 'Zoe (A)' },
    ],
  },
  {
    name: 'Kiwologoma',
    mcs: [
      { name: 'Harvest (T)' },
      { name: 'Little Lighters (C)' },
      { name: 'Redemption (A)' },
      { name: 'Redemption Kids (C)' },
      { name: 'Restoration (A)' },
      { name: 'Solomon (A)' },
      { name: 'Zion Wave (A)' },
    ],
  },
  {
    name: 'Najjera',
    mcs: [
      { name: 'Faraja (A)' },
      { name: "God's Will (A)" },
      { name: 'Heirs of The Promise (A)' },
      { name: 'Hosanna (A)' },
      { name: 'Hosanna Kids (C)' },
      { name: 'New Life (A)' },
    ],
  },
  {
    name: 'Namirembe rd',
    mcs: [
      { name: 'Cubs of Judah(C)' },
      { name: 'Lion of Judah (A)' },
      { name: "Messiah's Own (T)" },
      { name: 'Tendo (C)' },
    ],
  },
  {
    name: 'Nsasa',
    mcs: [
      { name: 'Abundance (A)' },
      { name: 'Called to Greatness (C)' },
      { name: 'Glory MC (A)' },
      { name: "Heaven's little Heroes (C)" },
      { name: 'Renaissance (T)' },
      { name: 'Shalac (T)' },
      { name: 'Shape (A)' },
      { name: 'Steadfast (T)' },
    ],
  },
];

@Injectable()
export class WhmGroupTreeSeedService {
  private groupRepo: Repository<Group>;
  private categoryRepo: Repository<GroupCategory>;
  private tenantRepo: Repository<Tenant>;
  private membershipRepo: Repository<GroupMembership>;
  private userRepo: Repository<User>;

  constructor(@InjectConnection() private connection: Connection) {}

  private init(): void {
    this.groupRepo = this.connection.getRepository(Group);
    this.categoryRepo = this.connection.getRepository(GroupCategory);
    this.tenantRepo = this.connection.getRepository(Tenant);
    this.membershipRepo = this.connection.getRepository(GroupMembership);
    this.userRepo = this.connection.getRepository(User);
  }

  async seedGroupTree(): Promise<void> {
    this.init();
    Logger.log('🌲 [WHM] Seeding group tree...');

    const tenant = await this.tenantRepo.findOne({
      where: { name: 'worshipharvest' },
    });
    if (!tenant) throw new Error('WHM tenant not found — run base seed first');

    const movementCat = await this.cat(tenant, 'Movement');
    const regionCat = await this.cat(tenant, 'Region');
    const fobCat = await this.cat(tenant, 'Forward Operating Base');
    const locationCat = await this.cat(tenant, 'Location');
    const zoneCat = await this.cat(tenant, 'Zone');
    const mcCat = await this.cat(tenant, 'Missional Community');

    if (
      !movementCat ||
      !regionCat ||
      !fobCat ||
      !locationCat ||
      !zoneCat ||
      !mcCat
    ) {
      throw new Error(
        'Required group categories missing — run seedGroupCategories first',
      );
    }

    // Build code → definition lookup
    const locationDefs = new Map(WHM_LOCATIONS.map((l) => [l.code, l]));

    // 1. Movement root
    const movement = await this.findOrCreate(
      'Worship Harvest',
      movementCat,
      tenant,
      null,
    );

    let fobCount = 0;
    let locCreated = 0;
    let locExisting = 0;
    const assignedCodes = new Set<string>();
    let whktkt: Group | null = null;

    // 2. Regions → FOBs → Locations
    for (const regionDef of REGION_FOB_LOCATION_MAP) {
      const region = await this.findOrCreate(
        regionDef.region,
        regionCat,
        tenant,
        movement,
      );

      for (const fobDef of regionDef.fobs) {
        const fob = await this.findOrCreate(
          fobDef.name,
          fobCat,
          tenant,
          region,
        );
        fobCount++;

        for (const code of fobDef.codes) {
          assignedCodes.add(code);
          const def = locationDefs.get(code);
          if (!def) {
            Logger.warn(
              `[WHM] Code ${code} (${fobDef.name}) not in location master list`,
            );
            continue;
          }
          const [loc, created] = await this.findOrCreateLocation(
            def.code,
            def.name,
            locationCat,
            tenant,
            fob,
          );
          if (created) locCreated++;
          else locExisting++;
          if (code === 'WHKTKT') whktkt = loc;
        }
      }
    }

    Logger.log(
      `[WHM] 6 regions | ${fobCount} FOBs | ${locCreated} locations created, ${locExisting} existing`,
    );

    // 3. WHKTKT internal structure (zones + MCs)
    if (whktkt) {
      await this.seedWhktktZones(whktkt, zoneCat, mcCat, tenant);
    } else {
      Logger.warn('[WHM] WHKTKT not found — skipping zones/MCs');
    }

    Logger.log('✅ [WHM] Group tree complete.');
    return;
  }

  /** Attach (or repair) a Leader membership for an admin user on the top-level Movement. */
  async assignAdminToMovement(username: string): Promise<void> {
    this.init();
    const tenant = await this.tenantRepo.findOne({
      where: { name: 'worshipharvest' },
    });
    if (!tenant) return;

    // Scope movement lookup to the Movement category so a same-name group in
    // another category cannot match.
    const movementCat = await this.categoryRepo.findOne({
      where: { name: 'Movement', tenant: { id: tenant.id } },
    });
    const movement = movementCat
      ? await this.groupRepo
          .createQueryBuilder('g')
          .where('g."tenantId" = :t', { t: tenant.id })
          .andWhere('g."categoryId" = :cat', { cat: movementCat.id })
          .andWhere('g.name = :n', { n: 'Worship Harvest' })
          .getOne()
      : null;

    const user = await this.userRepo.findOne({ where: { username } });
    if (!user || !movement) return;

    const existing = await this.membershipRepo.findOne({
      where: { contactId: user.contactId, groupId: movement.id },
    });

    if (existing) {
      // Repair if the membership is inactive or not Leader
      if (!existing.isActive || existing.role !== GroupRole.Leader) {
        existing.isActive = true;
        existing.role = GroupRole.Leader;
        await this.membershipRepo.save(existing);
        Logger.log('[WHM] Repaired admin membership on Worship Harvest');
      }
      return;
    }

    await this.membershipRepo.save(
      this.membershipRepo.create({
        contactId: user.contactId,
        groupId: movement.id,
        role: GroupRole.Leader,
        isActive: true,
      }),
    );
    Logger.log('[WHM] Admin assigned to Worship Harvest');
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private async cat(
    tenant: Tenant,
    name: string,
  ): Promise<GroupCategory | null> {
    return this.categoryRepo.findOne({
      where: { name, tenant: { id: tenant.id } },
    });
  }

  private async findOrCreate(
    name: string,
    category: GroupCategory,
    tenant: Tenant,
    parent: Group | null,
  ): Promise<Group> {
    const [group] = await this.findOrCreateByNameAndParent(
      name,
      category,
      tenant,
      parent,
    );
    return group;
  }

  private async findOrCreateByNameAndParent(
    name: string,
    category: GroupCategory,
    tenant: Tenant,
    parent: Group | null,
  ): Promise<[Group, boolean]> {
    const qb = this.groupRepo
      .createQueryBuilder('g')
      .where('g."tenantId" = :tenantId', { tenantId: tenant.id })
      .andWhere('g."categoryId" = :catId', { catId: category.id })
      .andWhere('g.name = :name', { name });

    parent
      ? qb.andWhere('g."parentId" = :parentId', { parentId: parent.id })
      : qb.andWhere('g."parentId" IS NULL');

    const existing = await qb.getOne();
    if (existing) return [existing, false];

    return [
      await this.groupRepo.save(
        this.groupRepo.create({
          name,
          category,
          tenant,
          parent: parent ?? undefined,
          privacy: GroupPrivacy.Public,
        }),
      ),
      true,
    ];
  }

  private async findOrCreateLocation(
    code: string,
    name: string,
    category: GroupCategory,
    tenant: Tenant,
    parent: Group,
  ): Promise<[Group, boolean]> {
    // 1. Primary lookup: match by metaData.code (stable identity)
    const byCode = await this.groupRepo
      .createQueryBuilder('g')
      .where('g."tenantId" = :tenantId', { tenantId: tenant.id })
      .andWhere('g."categoryId" = :catId', { catId: category.id })
      .andWhere('g."metaData"->>\'code\' = :code', { code })
      .getOne();

    if (byCode) {
      // Reparent if the location moved to a different FOB
      if (byCode.parentId !== parent.id) {
        byCode.parent = parent;
        await this.groupRepo.save(byCode);
      }
      return [byCode, false];
    }

    // 2. Fallback: match legacy rows by name (no code in metaData yet)
    const byName = await this.groupRepo
      .createQueryBuilder('g')
      .where('g."tenantId" = :tenantId', { tenantId: tenant.id })
      .andWhere('g."categoryId" = :catId', { catId: category.id })
      .andWhere('g.name = :name', { name })
      .getOne();

    if (byName) {
      // Stamp the code and reparent to the correct FOB
      byName.metaData = { ...(byName.metaData ?? {}), code };
      byName.parent = parent;
      await this.groupRepo.save(byName);
      return [byName, false];
    }

    // 3. Create new
    return [
      await this.groupRepo.save(
        this.groupRepo.create({
          name,
          category,
          tenant,
          parent,
          privacy: GroupPrivacy.Public,
          metaData: { code },
        }),
      ),
      true,
    ];
  }

  private async seedWhktktZones(
    whktkt: Group,
    zoneCat: GroupCategory,
    mcCat: GroupCategory,
    tenant: Tenant,
  ): Promise<void> {
    let zones = 0;
    let mcs = 0;
    for (const zoneDef of WHKTKT_ZONES) {
      const [zone, zc] = await this.findOrCreateByNameAndParent(
        zoneDef.name,
        zoneCat,
        tenant,
        whktkt,
      );
      if (zc) zones++;
      for (const mcDef of zoneDef.mcs) {
        const [, mc] = await this.findOrCreateByNameAndParent(
          mcDef.name,
          mcCat,
          tenant,
          zone,
        );
        if (mc) mcs++;
      }
    }
    Logger.log(`[WHM] WHKTKT: ${zones} zones, ${mcs} MCs created`);
  }
}
