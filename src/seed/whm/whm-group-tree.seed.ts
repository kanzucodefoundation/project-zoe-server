import { Injectable, Logger } from '@nestjs/common';
import { InjectConnection } from '@nestjs/typeorm';
import { Connection, Repository } from 'typeorm';
import Group from 'src/groups/entities/group.entity';
import GroupCategory from 'src/groups/entities/groupCategory.entity';
import { Tenant } from 'src/tenants/entities/tenant.entity';
import { GroupCategoryPurpose } from 'src/groups/enums/groups';
import { GroupPrivacy } from 'src/groups/enums/groupPrivacy';
import GroupMembership from 'src/groups/entities/groupMembership.entity';
import { GroupRole } from 'src/groups/enums/groupRole';
import { User } from 'src/users/entities/user.entity';

// ---------------------------------------------------------------------------
// WHM location master list — 242 entries from worship_harvest_categorization_data.json
// ---------------------------------------------------------------------------
// FOB assignments are pending. All non-Kitukutwe locations are placed directly
// under the "WHM Uganda" structure group. Run import-fobs-locations.ts with the
// canonical fobs_locations.csv to attach locations to their FOBs once available.
// ---------------------------------------------------------------------------
const WHM_LOCATIONS: { code: string; name: string }[] = [
  { code: 'WHABYT', name: 'WH Abayita' },
  { code: 'WHAFOL', name: 'WH Africa Online' },
  { code: 'WHAONL', name: 'WHAONL' },
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
  { code: 'WHBKYA', name: 'WHBKYA' },
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
  { code: 'WHBUSG', name: 'WHBUSG' },
  { code: 'WHBUSK', name: 'WH Busiika' },
  { code: 'WHBWBJ', name: 'WH Bwebajja' },
  { code: 'WHBWGA', name: 'WH Bwerenga' },
  { code: 'WHBWNG', name: 'WH Buwenge' },
  { code: 'WHBWYA', name: 'WH Buwaya' },
  { code: 'WHBYGR', name: 'WH Bweyogerere' },
  { code: 'WHBZGA', name: 'WH Buziga' },
  { code: 'WHCNDA', name: 'WH Canada' },
  { code: 'WHDNTN', name: 'WHDNTN' },
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
  { code: 'WHIDDI', name: 'WHIDDI' },
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
  { code: 'WHKGWA', name: 'WHKGWA' },
  { code: 'WHKHRA', name: 'WH Kaihura' },
  { code: 'WHKIRA', name: 'WH Kira' },
  { code: 'WHKISG', name: 'WH Kisoga' },
  { code: 'WHKITD', name: 'WH Kitende' },
  { code: 'WHKITI', name: 'WH Kiti' },
  { code: 'WHKITO', name: 'WH Kito-Kisooba' },
  { code: 'WHKJBJ', name: 'WH Kijabijjo' },
  { code: 'WHKJNS', name: 'WH kajjansi' },
  { code: 'WHKKBA', name: 'WH Kakoba' },
  { code: 'WHKKRA', name: 'WH Kakira' },
  { code: 'WHKKRI', name: 'WH Kakiri' },
  { code: 'WHKLBR', name: 'WH Kulambiro' },
  { code: 'WHKLGI', name: 'WH Kalagi' },
  { code: 'WHKLMZ', name: 'WH Kilemezi' },
  { code: 'WHKLRO', name: 'WH Kaliro' },
  { code: 'WHKMBU', name: 'WH Kiamu' },
  { code: 'WHKMLI', name: 'WH Kamuli' },
  { code: 'WHKMNY', name: 'WH Kimwanyi' },
  { code: 'WHKMWK', name: 'WHKMWK' },
  { code: 'WHKNYO', name: 'WHKNYO' },
  { code: 'WHKONL', name: 'WHKONL' },
  { code: 'WHKRCH', name: 'WH Kericho' },
  { code: 'WHKRNY', name: 'WH Kirinya' },
  { code: 'WHKSAS', name: 'WH Kisaasi' },
  { code: 'WHKSBI', name: 'WH Kasubi' },
  { code: 'WHKSGJ', name: 'WH Kasengejje' },
  { code: 'WHKSKS', name: 'WHKSKS' },
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
  { code: 'WHKYJO', name: 'WHKYJO' },
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
  { code: 'WHMASK', name: 'WHMASK' },
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
  { code: 'WHMSKA', name: 'WH Masaka' },
  { code: 'WHMSLT', name: 'WH Masulita' },
  { code: 'WHMSND', name: 'WH Masindi' },
  { code: 'WHMSNF', name: 'WH Masanafu' },
  { code: 'WHMTAI', name: 'WH Mutai' },
  { code: 'WHMTGB', name: 'WH Mutungo-Biina' },
  { code: 'WHMTND', name: 'WH Mutundwe' },
  { code: 'WHMTUG', name: 'WH Matugga' },
  { code: 'WHMTWE', name: 'WHMTWE' },
  { code: 'WHMTYN', name: 'WH Mityana' },
  { code: 'WHMWFU', name: 'WH Muwafu' },
  { code: 'WHMWGL', name: 'WH Mawangala' },
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
  { code: 'WHNMPG', name: 'WH Nampunge' },
  { code: 'WHNMTB', name: 'WH Namataba' },
  { code: 'WHNMVD', name: 'WHNMVD' },
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
  { code: 'WHNTND', name: 'WHNTND' },
  { code: 'WHNTTE', name: 'WHNTTE' },
  { code: 'WHNTWO', name: 'WH Ntawo' },
  { code: 'WHNWLS', name: 'WH North Wales' },
  { code: 'WHNWPD', name: 'WH Nawampanda' },
  { code: 'WHNYDO', name: 'WH Nyendo' },
  { code: 'WHNYSA', name: 'WH Yesu Amala' },
  { code: 'WHONGR', name: 'WH Ongata Rongai' },
  { code: 'WHPDHA', name: 'WH Paidha' },
  { code: 'WHPKCH', name: 'WH Pakwach' },
  { code: 'WHPLSA', name: 'WH Pallisa' },
  { code: 'WHRBGA', name: 'WH Rubaga' },
  { code: 'WHRUIR', name: 'WH Ruiru' },
  { code: 'WHSEGK', name: 'WH Seguku' },
  { code: 'WHSETA', name: 'WH Seeta' },
  { code: 'WHSLRD', name: 'WH Salama Road' },
  { code: 'WHSNTM', name: 'WH Sentema' },
  { code: 'WHSOND', name: 'WH Sonde' },
  { code: 'WHSROT', name: 'WH Soroti' },
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

// Kitukutwe FOB — confirmed member codes (from kitukutwe_fob_dashboard_data.json)
const KTKT_FOB_CODES = new Set([
  'WHKTKT',
  'WHNKWR',
  'WHNSSA',
  'WHNBSG',
  'WHNKSJ',
  'WHKLGI',
  'WHKJBJ',
  'WHKMNY',
]);

// WHKTKT zones and MCs (from whktkt_zonal_dashboard_data.json latestRows)
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
    Logger.log('🌲 [WHM] Seeding WHM group tree...');

    const tenant = await this.tenantRepo.findOne({
      where: { name: 'worshipharvest' },
    });
    if (!tenant) throw new Error('WHM tenant not found — run base seed first');

    const structureCat = await this.categoryRepo.findOne({
      where: {
        purpose: GroupCategoryPurpose.STRUCTURE,
        tenant: { id: tenant.id },
      },
    });
    const locationCat = await this.categoryRepo.findOne({
      where: {
        purpose: GroupCategoryPurpose.LOCATION,
        tenant: { id: tenant.id },
      },
    });
    const fellowshipCat = await this.categoryRepo.findOne({
      where: {
        purpose: GroupCategoryPurpose.FELLOWSHIP,
        tenant: { id: tenant.id },
      },
    });

    if (!structureCat || !locationCat || !fellowshipCat) {
      throw new Error(
        'Required group categories not found — run base seed first',
      );
    }

    // 1. Top-level region
    const region = await this.findOrCreate(
      'WHM Uganda',
      structureCat,
      tenant,
      null,
    );

    // 2. Kitukutwe FOB
    const ktktFob = await this.findOrCreate(
      'Kitukutwe FOB',
      structureCat,
      tenant,
      region,
    );

    // 3. All 242 locations
    const locationByCode = new Map<string, Group>();
    let created = 0;
    let skipped = 0;

    for (const loc of WHM_LOCATIONS) {
      const parent = KTKT_FOB_CODES.has(loc.code) ? ktktFob : region;
      const [group, wasCreated] = await this.findOrCreateLocation(
        loc.code,
        loc.name,
        locationCat,
        tenant,
        parent,
      );
      locationByCode.set(loc.code, group);
      if (wasCreated) created++;
      else skipped++;
    }
    Logger.log(
      `[WHM] Locations: ${created} created, ${skipped} already existed`,
    );

    // 4. WHKTKT zones and MCs
    const whktkt = locationByCode.get('WHKTKT');
    if (!whktkt) {
      Logger.warn(
        '[WHM] WHKTKT not found in locationByCode — skipping zones/MCs',
      );
      return;
    }

    let zoneCreated = 0;
    let mcCreated = 0;

    for (const zoneDef of WHKTKT_ZONES) {
      const [zone, zoneWasCreated] = await this.findOrCreateByNameAndParent(
        zoneDef.name,
        structureCat,
        tenant,
        whktkt,
      );
      if (zoneWasCreated) zoneCreated++;

      for (const mcDef of zoneDef.mcs) {
        const [, mcWasCreated] = await this.findOrCreateByNameAndParent(
          mcDef.name,
          fellowshipCat,
          tenant,
          zone,
        );
        if (mcWasCreated) mcCreated++;
      }
    }

    Logger.log(`[WHM] WHKTKT: ${zoneCreated} zones, ${mcCreated} MCs created`);

    // 5. Demo user group memberships
    await this.seedDemoMemberships(region, ktktFob, whktkt);

    Logger.log('✅ [WHM] Group tree seeded.');
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

    if (parent) {
      qb.andWhere('g."parentId" = :parentId', { parentId: parent.id });
    } else {
      qb.andWhere('g."parentId" IS NULL');
    }

    const existing = await qb.getOne();
    if (existing) return [existing, false];

    const group = this.groupRepo.create({
      name,
      category,
      tenant,
      parent: parent ?? undefined,
      privacy: GroupPrivacy.Public,
    });
    return [await this.groupRepo.save(group), true];
  }

  private async seedDemoMemberships(
    region: Group,
    ktktFob: Group,
    whktkt: Group,
  ): Promise<void> {
    const kitukutweZone = await this.groupRepo
      .createQueryBuilder('g')
      .where('g."parentId" = :parentId', { parentId: whktkt.id })
      .andWhere('g.name = :name', { name: 'Kitukutwe' })
      .getOne();

    const arrowsMc = kitukutweZone
      ? await this.groupRepo
          .createQueryBuilder('g')
          .where('g."parentId" = :parentId', { parentId: kitukutweZone.id })
          .andWhere('g.name = :name', { name: 'Arrows (C)' })
          .getOne()
      : null;

    const assignments: { username: string; group: Group | null }[] = [
      { username: 'fellowship@worshipharvest.org', group: arrowsMc },
      { username: 'zone@worshipharvest.org', group: kitukutweZone },
      { username: 'location@worshipharvest.org', group: whktkt },
      { username: 'fob@worshipharvest.org', group: ktktFob },
      { username: 'network@worshipharvest.org', group: region },
      { username: 'movement@worshipharvest.org', group: region },
      { username: 'admin@worshipharvest.org', group: region },
    ];

    let assigned = 0;
    let skipped = 0;

    for (const { username, group } of assignments) {
      if (!group) {
        Logger.warn(
          `[WHM] Demo membership skipped — group not found for ${username}`,
        );
        skipped++;
        continue;
      }

      const user = await this.userRepo.findOne({ where: { username } });
      if (!user) {
        Logger.warn(
          `[WHM] Demo membership skipped — user not found: ${username}`,
        );
        skipped++;
        continue;
      }

      const existing = await this.membershipRepo.findOne({
        where: { contactId: user.contactId, groupId: group.id },
      });
      if (existing) {
        skipped++;
        continue;
      }

      await this.membershipRepo.save(
        this.membershipRepo.create({
          contactId: user.contactId,
          groupId: group.id,
          role: GroupRole.Leader,
          isActive: true,
        }),
      );
      assigned++;
    }

    Logger.log(
      `[WHM] Demo memberships: ${assigned} assigned, ${skipped} skipped`,
    );
  }

  private async findOrCreateLocation(
    code: string,
    name: string,
    category: GroupCategory,
    tenant: Tenant,
    parent: Group,
  ): Promise<[Group, boolean]> {
    const existing = await this.groupRepo
      .createQueryBuilder('g')
      .where('g."tenantId" = :tenantId', { tenantId: tenant.id })
      .andWhere('g."categoryId" = :catId', { catId: category.id })
      .andWhere('g."metaData"->>\'code\' = :code', { code })
      .getOne();

    if (existing) return [existing, false];

    const group = this.groupRepo.create({
      name,
      category,
      tenant,
      parent,
      privacy: GroupPrivacy.Public,
      metaData: { code },
    });
    return [await this.groupRepo.save(group), true];
  }
}
